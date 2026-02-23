package org.test.vpnflask;

import android.content.Intent;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import java.io.IOException;

public class PythonVpnService extends VpnService {
    private ParcelFileDescriptor mInterface;
    private Thread mThread;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "START_VPN".equals(intent.getAction())) {
            // Stop previous thread if running
            if (mThread != null) mThread.interrupt();
            
            mThread = new Thread(() -> {
                configureVpn();
            });
            mThread.start();
        }
        return START_STICKY;
    }

    private void configureVpn() {
        if (mInterface != null) return;
        try {
            Log.i("PythonVpnService", "Building VPN Interface...");
            Builder builder = new Builder();
            builder.setSession("PythonVPN")
                   .addAddress("10.0.0.2", 24)
                   .addDnsServer("8.8.8.8")
                   .addRoute("0.0.0.0", 0);
            
            // Establish the TUN interface
            mInterface = builder.establish();
            Log.i("PythonVpnService", "Interface Established: " + mInterface);
            
            // TODO: Here is where you would start the loop to read/write packets
            // straight from mInterface.getFileDescriptor()
            
        } catch (Exception e) {
            Log.e("PythonVpnService", "Error", e);
        }
    }

    @Override
    public void onDestroy() {
        try { if (mInterface != null) mInterface.close(); } catch (Exception e) {}
        super.onDestroy();
    }
}
