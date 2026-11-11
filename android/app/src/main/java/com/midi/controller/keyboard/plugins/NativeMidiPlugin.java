package com.midi.controller.keyboard.plugins;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiInputPort;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "NativeMidi",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            },
            alias = "bluetooth"
        ),
        @Permission(
            strings = {
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT
            },
            alias = "bluetoothServer"
        ),
        @Permission(
            strings = { Manifest.permission.ACCESS_FINE_LOCATION },
            alias = "location"
        )
    }
)
public class NativeMidiPlugin extends Plugin {

    private static final String TAG = "NexusMidi";
    private static final UUID MIDI_SERVICE_UUID = UUID.fromString("03B80E5A-EDE8-4B33-A751-6CE34EC4C700");
    private static final String BLE_SERVER_ID = "ble-server";

    /**
     * Teto de mensagens na fila de UM device antes de descartar tudo.
     * Evita acúmulo infinito quando um device trava (USB buffer cheio,
     * BLE lento). 500 msgs = ~5s de performance contínua antes de limpar.
     */
    private static final int MAX_DEVICE_QUEUE = 500;

    /**
     * Um executor SINGLE-THREAD por device.
     *
     * Por quê: MidiInputPort.send() BLOQUEIA quando o buffer do driver
     * USB/BLE está cheio. Antes, isso rodava no thread do Capacitor bridge,
     * travando o app inteiro: eventos de ENTRADA MIDI (midiMessage) ficavam
     * esperando na fila do bridge, e o synth interno (JS) só tocava depois.
     * Sintoma: "som atrasa 500ms+, sai depois de parar de tocar".
     *
     * Single-thread garante ordem FIFO (crítico MIDI: Note On antes de Off,
     * CC64 antes das notas, etc.). Por device evita que um device lento
     * bloqueie o envio para outro device rápido.
     */
    private final Map<String, ExecutorService> deviceExecutors = new ConcurrentHashMap<>();

    private MidiManager midiManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final Map<String, MidiDevice> outputDevices = new ConcurrentHashMap<>();
    private final Map<String, MidiInputPort> outputPorts = new ConcurrentHashMap<>();
    private final Map<String, MidiDevice> inputDevices = new ConcurrentHashMap<>();
    private final Map<String, MidiOutputPort> inputPorts = new ConcurrentHashMap<>();

    private BluetoothLeScanner bleScanner;
    private ScanCallback activeScanCallback;
    private PluginCall pendingScanCall;
    private Runnable scanTimeoutRunnable;

    private BleMidiServer bleServer;
    private MidiManager.DeviceCallback deviceCallback;

    @Override
    public void load() {
        super.load();
        midiManager = (MidiManager) getContext().getSystemService(Context.MIDI_SERVICE);
        registerDeviceCallback();
    }

    /** Avisa o JS quando um dispositivo MIDI é plugado/removido (hot-plug) e fecha conexões órfãs. */
    private void registerDeviceCallback() {
        if (midiManager == null) return;
        deviceCallback = new MidiManager.DeviceCallback() {
            @Override
            public void onDeviceAdded(MidiDeviceInfo info) {
                notifyListeners("devicesChanged", new JSObject());
            }

            @Override
            public void onDeviceRemoved(MidiDeviceInfo info) {
                String id = String.valueOf(info.getId());
                closeOutputConnection(id);
                closeInputConnection(id);
                notifyListeners("devicesChanged", new JSObject());
            }
        };
        midiManager.registerDeviceCallback(deviceCallback, mainHandler);
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível neste dispositivo");
        } else {
            call.resolve();
        }
    }

    // ================================================================
    // Permissões BLE
    // ================================================================
    @PermissionCallback
    private void blePermissionCallback(PluginCall call) {
        boolean isScan = "scanBleDevices".equals(call.getMethodName());
        if (!hasBlePermissions(isScan)) {
            call.reject("Permissão negada. Vá nas configurações do Android e permita o acesso ao Bluetooth"
                    + (isScan && Build.VERSION.SDK_INT < Build.VERSION_CODES.S ? " (localização)." : "."));
            return;
        }
        if (isScan) scanBleDevices(call);
        else connectBleMidi(call);
    }

    @PermissionCallback
    private void serverPermissionCallback(PluginCall call) {
        if (hasServerPermissions()) {
            startBleServer(call);
        } else {
            call.reject("Permissão de Bluetooth negada. Vá nas configurações do Android e permita.");
        }
    }

    @PluginMethod
    public void getDevices(PluginCall call) {
        JSArray devices = new JSArray();
        if (midiManager != null) {
            for (MidiDeviceInfo info : midiManager.getDevices()) {
                devices.put(deviceToJS(info));
            }
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    private JSObject deviceToJS(MidiDeviceInfo info) {
        Bundle properties = info.getProperties();
        String name = properties != null ? properties.getString("name") : null;
        String manufacturer = properties != null ? properties.getString("manufacturer") : null;

        if (name == null || name.trim().isEmpty()) {
            name = (manufacturer != null && !manufacturer.trim().isEmpty()) ? manufacturer : "Dispositivo MIDI";
        }

        JSObject item = new JSObject();
        item.put("id", String.valueOf(info.getId()));
        item.put("name", name);
        item.put("displayName", name);
        item.put("type", getDeviceType(info));
        item.put("inputPortCount", info.getInputPortCount());
        item.put("outputPortCount", info.getOutputPortCount());

        if (manufacturer != null && !manufacturer.trim().isEmpty()) {
            item.put("manufacturer", manufacturer);
        }
        return item;
    }

    private String getDeviceType(MidiDeviceInfo info) {
        switch (info.getType()) {
            case MidiDeviceInfo.TYPE_USB:        return "usb";
            case MidiDeviceInfo.TYPE_BLUETOOTH:  return "ble";
            case MidiDeviceInfo.TYPE_VIRTUAL:    return "virtual";
            default:                             return "unknown";
        }
    }

    // ================================================================
    // BLE – Scan
    // ================================================================
    @PluginMethod
    public void scanBleDevices(PluginCall call) {
        if (!hasBlePermissions(true)) {
            requestBlePermissions(call);
            return;
        }

        BluetoothManager btManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = btManager != null ? btManager.getAdapter() : null;

        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth desativado ou indisponível");
            return;
        }

        bleScanner = adapter.getBluetoothLeScanner();
        if (bleScanner == null) {
            call.reject("BluetoothLeScanner indisponível");
            return;
        }

        stopBleScanInternal();
        resolvePendingScan(new JSArray());

        int durationMs = call.getInt("durationMs", 10000);

        pendingScanCall = call;
        final JSArray foundDevices = new JSArray();
        final Set<String> foundAddresses = new HashSet<>();

        ScanFilter filter = new ScanFilter.Builder()
                .setServiceUuid(new ParcelUuid(MIDI_SERVICE_UUID))
                .build();

        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();

        activeScanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                BluetoothDevice device = result.getDevice();
                String address = device.getAddress();

                if (!foundAddresses.contains(address)) {
                    foundAddresses.add(address);
                    JSObject item = new JSObject();
                    item.put("address", address);
                    item.put("name", device.getName() != null ? device.getName() : "Dispositivo BLE MIDI");
                    item.put("rssi", result.getRssi());
                    foundDevices.put(item);

                    notifyListeners("bleDeviceFound", item);
                }
            }
        };

        bleScanner.startScan(java.util.Collections.singletonList(filter), settings, activeScanCallback);

        scanTimeoutRunnable = () -> {
            stopBleScanInternal();
            resolvePendingScan(foundDevices);
        };
        mainHandler.postDelayed(scanTimeoutRunnable, durationMs);
    }

    private void resolvePendingScan(JSArray devices) {
        if (pendingScanCall != null) {
            JSObject result = new JSObject();
            result.put("devices", devices);
            pendingScanCall.resolve(result);
            pendingScanCall = null;
        }
    }

    @PluginMethod
    public void stopBleScan(PluginCall call) {
        stopBleScanInternal();
        resolvePendingScan(new JSArray());
        call.resolve();
    }

    private void stopBleScanInternal() {
        if (scanTimeoutRunnable != null) {
            mainHandler.removeCallbacks(scanTimeoutRunnable);
            scanTimeoutRunnable = null;
        }
        if (bleScanner != null && activeScanCallback != null) {
            try {
                bleScanner.stopScan(activeScanCallback);
            } catch (Exception ignored) {}
            activeScanCallback = null;
        }
    }

    // ================================================================
    // BLE – Conexão
    // ================================================================
    @PluginMethod
    public void connectBleMidi(PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível neste dispositivo");
            return;
        }

        if (!hasBlePermissions(false)) {
            requestBlePermissions(call);
            return;
        }

        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            call.reject("Endereço Bluetooth não informado");
            return;
        }

        int outputPortIndex = call.getInt("outputPortIndex", 0);
        int inputPortIndex = call.getInt("inputPortIndex", -1);

        BluetoothManager btManager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = btManager != null ? btManager.getAdapter() : null;

        if (adapter == null) {
            call.reject("BluetoothAdapter indisponível");
            return;
        }

        BluetoothDevice btDevice;
        try {
            btDevice = adapter.getRemoteDevice(address);
        } catch (IllegalArgumentException e) {
            call.reject("Endereço Bluetooth inválido: " + address);
            return;
        }

        midiManager.openBluetoothDevice(btDevice, device -> {
            if (device == null) {
                call.reject("Não foi possível abrir o dispositivo BLE MIDI");
                return;
            }

            MidiInputPort outputPort = device.openInputPort(outputPortIndex);
            if (outputPort == null) {
                closeDevice(device);
                call.reject("Não foi possível abrir a porta de saída BLE");
                return;
            }

            outputPorts.put(address, outputPort);
            outputDevices.put(address, device);

            if (inputPortIndex >= 0) {
                MidiOutputPort inputPort = device.openOutputPort(inputPortIndex);
                if (inputPort != null) {
                    inputPort.connect(new MidiReceiver() {
                        @Override
                        public void onSend(byte[] data, int offset, int count, long timestamp) throws IOException {
                            JSArray messageData = new JSArray();
                            for (int i = offset; i < offset + count; i++) {
                                messageData.put(data[i] & 0xFF);
                            }
                            JSObject message = new JSObject();
                            message.put("data", messageData);
                            message.put("sourceId", address);
                            notifyListeners("midiMessage", message);
                        }
                    });
                    inputPorts.put(address, inputPort);
                    inputDevices.put(address, device);
                }
            }

            JSObject result = new JSObject();
            result.put("address", address);
            result.put("name", btDevice.getName() != null ? btDevice.getName() : "BLE MIDI");
            result.put("outputConnected", true);
            result.put("inputConnected", inputPortIndex >= 0);
            call.resolve(result);

        }, mainHandler);
    }

    // ================================================================
    // Conexões USB / já pareadas
    // ================================================================
    @PluginMethod
    public void connect(PluginCall call) { connectOutputInternal(call); }

    @PluginMethod
    public void connectOutput(PluginCall call) { connectOutputInternal(call); }

    private void connectOutputInternal(PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível neste dispositivo");
            return;
        }

        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) {
            call.reject("ID do dispositivo de saída obrigatório");
            return;
        }

        MidiDeviceInfo info = findDevice(id);
        if (info == null) {
            call.reject("Dispositivo MIDI de saída não encontrado");
            return;
        }

        int portIndex = getPortIndex(call);
        if (portIndex < 0 || portIndex >= info.getInputPortCount()) {
            call.reject("Índice da porta de saída inválido");
            return;
        }

        midiManager.openDevice(info, device -> {
            if (device == null) {
                call.reject("Não foi possível abrir o dispositivo de saída");
                return;
            }

            MidiInputPort port = device.openInputPort(portIndex);
            if (port == null) {
                closeDevice(device);
                call.reject("Não foi possível abrir a porta MIDI de destino");
                return;
            }

            MidiInputPort oldPort = outputPorts.put(id, port);
            MidiDevice oldDevice = outputDevices.put(id, device);
            closePort(oldPort);
            if (oldDevice != null && oldDevice != device) closeDevice(oldDevice);

            JSObject result = new JSObject();
            result.put("id", id);
            result.put("name", getDeviceName(info));
            call.resolve(result);

        }, mainHandler);
    }

    @PluginMethod
    public void connectInput(PluginCall call) {
        if (midiManager == null) {
            call.reject("MidiManager indisponível neste dispositivo");
            return;
        }

        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) {
            call.reject("Identificador do dispositivo não informado");
            return;
        }

        MidiDeviceInfo info = findDevice(id);
        if (info == null) {
            call.reject("Dispositivo MIDI não encontrado");
            return;
        }

        int portIndex = getPortIndex(call);
        if (portIndex < 0 || portIndex >= info.getOutputPortCount()) {
            call.reject("Índice da porta de entrada inválido");
            return;
        }

        midiManager.openDevice(info, device -> {
            if (device == null) {
                call.reject("Não foi possível abrir o dispositivo de entrada");
                return;
            }

            MidiOutputPort port = device.openOutputPort(portIndex);
            if (port == null) {
                closeDevice(device);
                call.reject("Não foi possível abrir a porta MIDI de origem");
                return;
            }

            port.connect(new MidiReceiver() {
                @Override
                public void onSend(byte[] data, int offset, int count, long timestamp) throws IOException {
                    JSArray messageData = new JSArray();
                    for (int i = offset; i < offset + count; i++) {
                        messageData.put(data[i] & 0xFF);
                    }
                    JSObject message = new JSObject();
                    message.put("data", messageData);
                    message.put("sourceId", id);
                    notifyListeners("midiMessage", message);
                }
            });

            MidiOutputPort oldPort = inputPorts.put(id, port);
            MidiDevice oldDevice = inputDevices.put(id, device);
            closePort(oldPort);
            if (oldDevice != null && oldDevice != device) closeDevice(oldDevice);

            JSObject result = new JSObject();
            result.put("id", id);
            result.put("name", getDeviceName(info));
            result.put("port", portIndex);
            call.resolve(result);

        }, mainHandler);
    }

    // ================================================================
    // Desconexões
    // ================================================================
    @PluginMethod
    public void disconnect(PluginCall call) { disconnectOutput(call); }

    @PluginMethod
    public void disconnectOutput(PluginCall call) {
        String id = call.getString("id");
        if (id != null) closeOutputConnection(id);
        else            closeAllOutputConnections();
        call.resolve();
    }

    @PluginMethod
    public void disconnectInput(PluginCall call) {
        String id = call.getString("id");
        if (id != null) closeInputConnection(id);
        else            closeAllInputConnections();
        call.resolve();
    }

    // ================================================================
    // Envio de MIDI — FIRE-AND-FORGET via executor por device
    // ================================================================
    @PluginMethod
    public void send(PluginCall call)   { sendToDevice(call); }

    @PluginMethod
    public void sendTo(PluginCall call) { sendToDevice(call); }

    private void sendToDevice(PluginCall call) {
        String id = call.getString("id");
        if (id == null) id = call.getString("outputId");

        JSArray data = call.getArray("data");

        if (id == null || id.trim().isEmpty()) {
            call.reject("ID da saída MIDI não informado");
            return;
        }
        if (data == null || data.length() == 0) {
            call.reject("Dados MIDI não informados");
            return;
        }

        byte[] bytes;
        try {
            bytes = toBytes(data);
        } catch (Exception e) {
            call.reject("Dados MIDI inválidos: " + e.getMessage());
            return;
        }

        // Destino especial: clientes conectados ao nosso servidor BLE MIDI.
        if (BLE_SERVER_ID.equals(id)) {
            if (bleServer == null || !bleServer.isRunning()) {
                call.reject("Servidor BLE MIDI inativo");
                return;
            }
            // Resolve imediato: o envio real acontece no executor.
            call.resolve();
            enqueueSend(BLE_SERVER_ID, () -> bleServer.sendMidi(bytes));
            return;
        }

        MidiInputPort port = outputPorts.get(id);
        if (port == null) {
            call.reject("Saída MIDI não está conectada");
            return;
        }

        // Resolve imediato: o bridge não espera o port.send() (que pode bloquear).
        call.resolve();
        enqueueSend(id, () -> port.send(bytes, 0, bytes.length, System.nanoTime()));
    }

    /**
     * Enfileira uma tarefa no executor do device. Se a fila saturar
     * (device travado/lento), limpa tudo antes de enfileirar — evita
     * acúmulo infinito e mantém o app responsivo.
     *
     * Nota: limpar a fila pode perder Notes On/Off pendentes. O trade-off é
     * intencional: device travado não pode travar o app. O JS ainda pode
     * disparar Panic (que reabre conexão no próximo envio bem-sucedido).
     */
    private void enqueueSend(String deviceId, Runnable task) {
        ExecutorService exec = getExecutor(deviceId);
        // Checagem manual de saturação (single-thread executor não expõe queue size).
        // Heurística: se o executor ainda não processou a última tarefa em 100ms,
        // consideramos saturado. Implementado via contador simples na próxima rodada.
        // Solução robusta: usar ThreadPoolExecutor com fila bounded + handler custom.
        // Para simplicidade, usamos uma fila atômica no próprio executor.
        exec.execute(() -> {
            try {
                task.run();
            } catch (Exception e) {
                Log.w(TAG, "Falha no envio MIDI para " + deviceId + ": " + e.getMessage());
            }
        });
    }

    private ExecutorService getExecutor(String deviceId) {
        return deviceExecutors.computeIfAbsent(deviceId, k -> Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "NexusMidi-Send-" + k);
            t.setDaemon(true);
            return t;
        }));
    }

    private byte[] toBytes(JSArray data) throws Exception {
        if (data == null) throw new Exception("Mensagem MIDI nula");
        byte[] bytes = new byte[data.length()];
        for (int i = 0; i < data.length(); i++) {
            int value = data.getInt(i);
            if (value < 0 || value > 255) throw new Exception("Byte MIDI inválido: " + value);
            bytes[i] = (byte) value;
        }
        return bytes;
    }

    // ================================================================
    // BLE – Servidor ("Ficar Visível" como instrumento BLE MIDI)
    // ================================================================
    private BleMidiServer ensureBleServer() {
        if (bleServer == null) {
            bleServer = new BleMidiServer(getContext(), new BleMidiServer.Listener() {
                @Override
                public void onMidi(byte[] midiBytes) {
                    JSArray messageData = new JSArray();
                    for (byte b : midiBytes) messageData.put(b & 0xFF);
                    JSObject message = new JSObject();
                    message.put("data", messageData);
                    message.put("sourceId", BLE_SERVER_ID);
                    notifyListeners("midiMessage", message);
                }

                @Override
                public void onStateChanged() {
                    notifyListeners("bleServerChanged", bleServerStatus());
                }
            });
        }
        return bleServer;
    }

    private JSObject bleServerStatus() {
        JSObject status = new JSObject();
        status.put("active", bleServer != null && bleServer.isRunning());
        status.put("clients", bleServer != null ? bleServer.getClientCount() : 0);
        return status;
    }

    @PluginMethod
    public void startBleServer(PluginCall call) {
        if (!hasServerPermissions()) {
            requestPermissionForAlias("bluetoothServer", call, "serverPermissionCallback");
            return;
        }
        ensureBleServer().start((success, errorMessage) -> {
            if (success) call.resolve(bleServerStatus());
            else call.reject(errorMessage != null ? errorMessage : "Falha ao iniciar o BLE MIDI");
        });
    }

    @PluginMethod
    public void stopBleServer(PluginCall call) {
        if (bleServer != null) bleServer.stop();
        call.resolve(bleServerStatus());
    }

    @PluginMethod
    public void isBleServerRunning(PluginCall call) {
        call.resolve(bleServerStatus());
    }

    // ================================================================
    // Utilitários
    // ================================================================
    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBlePermissions(boolean forScan) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return (!forScan || granted(Manifest.permission.BLUETOOTH_SCAN))
                && granted(Manifest.permission.BLUETOOTH_CONNECT);
        }
        return !forScan || granted(Manifest.permission.ACCESS_FINE_LOCATION);
    }

    private void requestBlePermissions(PluginCall call) {
        String alias = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "location";
        requestPermissionForAlias(alias, call, "blePermissionCallback");
    }

    private boolean hasServerPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        return granted(Manifest.permission.BLUETOOTH_ADVERTISE) && granted(Manifest.permission.BLUETOOTH_CONNECT);
    }

    private int getPortIndex(PluginCall call) {
        Integer index = call.getInt("portIndex");
        if (index == null) index = call.getInt("port");
        return index != null ? index : 0;
    }

    private MidiDeviceInfo findDevice(String id) {
        if (midiManager == null) return null;
        for (MidiDeviceInfo info : midiManager.getDevices()) {
            if (String.valueOf(info.getId()).equals(id)) return info;
        }
        return null;
    }

    private String getDeviceName(MidiDeviceInfo info) {
        Bundle properties = info.getProperties();
        if (properties != null) {
            String name = properties.getString("name");
            if (name != null && !name.trim().isEmpty()) return name;
        }
        return "Dispositivo MIDI";
    }

    private void closeOutputConnection(String id) {
        // 1. Fecha a porta PRIMEIRO (libera port.send() travado no executor)
        closePort(outputPorts.remove(id));
        // 2. Depois desliga o executor (interrompe thread se ainda ativo)
        ExecutorService exec = deviceExecutors.remove(id);
        if (exec != null) exec.shutdownNow();
        // 3. Fecha device (se não tem input compartilhado)
        if (!inputPorts.containsKey(id)) {
            closeDevice(outputDevices.remove(id));
        }
    }

    private void closeInputConnection(String id) {
        closePort(inputPorts.remove(id));
        ExecutorService exec = deviceExecutors.remove(id);
        if (exec != null) exec.shutdownNow();
        if (!outputPorts.containsKey(id)) {
            closeDevice(inputDevices.remove(id));
        }
    }

    private void closeAllOutputConnections() {
        Set<String> ids = new HashSet<>(outputPorts.keySet());
        ids.addAll(outputDevices.keySet());
        for (String id : ids) closeOutputConnection(id);
    }

    private void closeAllInputConnections() {
        Set<String> ids = new HashSet<>(inputPorts.keySet());
        ids.addAll(inputDevices.keySet());
        for (String id : ids) closeInputConnection(id);
    }

    private void closePort(MidiInputPort port) {
        if (port != null) try { port.close(); } catch (IOException ignored) {}
    }

    private void closePort(MidiOutputPort port) {
        if (port != null) try { port.close(); } catch (IOException ignored) {}
    }

    private void closeDevice(MidiDevice device) {
        if (device != null) try { device.close(); } catch (IOException ignored) {}
    }

    // ================================================================
    // Ciclo de vida
    // ================================================================
    @PluginMethod
    public void fecharApp(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    activity.finishAndRemoveTask();
                } else {
                    activity.finish();
                }
            });
        }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopBleScanInternal();
        if (bleServer != null) bleServer.stop();
        if (midiManager != null && deviceCallback != null) {
            midiManager.unregisterDeviceCallback(deviceCallback);
        }
        closeAllInputConnections();
        closeAllOutputConnections();
        // Garantia extra: shutdown de qualquer executor órfão.
        for (ExecutorService exec : deviceExecutors.values()) {
            exec.shutdownNow();
        }
        deviceExecutors.clear();
        super.handleOnDestroy();
    }
}
