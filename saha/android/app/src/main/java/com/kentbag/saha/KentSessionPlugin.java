package com.kentbag.saha;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Only the opaque signed session token is stored here. The key never leaves Android Keystore. */
@CapacitorPlugin(name = "KentSession")
public class KentSessionPlugin extends Plugin {
    private static final String KEY = "kent.session.v1";
    private SharedPreferences preferences() { return getContext().getSharedPreferences("kent_session", Context.MODE_PRIVATE); }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY)) return (SecretKey) store.getKey(KEY, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    @PluginMethod public void get(PluginCall call) {
        try {
            String stored = preferences().getString("token", null);
            JSObject result = new JSObject();
            if (stored != null) {
                String[] parts = stored.split(":");
                if (parts.length != 2) throw new IllegalStateException("Invalid session data");
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            }
            call.resolve(result);
        } catch (Exception error) { call.reject("Oturum okunamadı. Lütfen yeniden giriş yap."); }
    }
    @PluginMethod public void set(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.length() > 8192) { call.reject("Geçersiz oturum."); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            String stored = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!preferences().edit().putString("token", stored).commit()) throw new IllegalStateException("Write failed");
            call.resolve();
        } catch (Exception error) { call.reject("Oturum güvenle kaydedilemedi. Yeniden dene."); }
    }
    @PluginMethod public void clear(PluginCall call) {
        if (preferences().edit().remove("token").commit()) call.resolve();
        else call.reject("Oturum kapatılamadı. Yeniden dene.");
    }
}
