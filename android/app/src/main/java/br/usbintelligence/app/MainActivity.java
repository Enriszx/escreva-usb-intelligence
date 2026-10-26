package br.usbintelligence.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin próprio: acesso a pastas e pendrive via Storage Access Framework.
        registerPlugin(UsbiFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
