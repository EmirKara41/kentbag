package com.kentbag.saha;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KentSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
