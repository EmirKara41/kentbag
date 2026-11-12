"""Applies KentBağ native setup to a freshly added Capacitor Android project.
Usage: python android-setup.py <app-dir> <java-package> <versionName>"""
import re, sys, pathlib
app, pkg, version = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
root = pathlib.Path(__file__).resolve().parents[2]
java_dir = app / "android/app/src/main/java" / pkg.replace(".", "/")
plugin = (root / "saha/android/app/src/main/java/com/kentbag/saha/KentSessionPlugin.java").read_text(encoding="utf-8")
(java_dir / "KentSessionPlugin.java").write_text(plugin.replace("package com.kentbag.saha;", f"package {pkg};"), encoding="utf-8")
(java_dir / "MainActivity.java").write_text(f"""package {pkg};

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {{
    @Override public void onCreate(Bundle savedInstanceState) {{
        registerPlugin(KentSessionPlugin.class);
        super.onCreate(savedInstanceState);
    }}
}}
""", encoding="utf-8")
manifest = app / "android/app/src/main/AndroidManifest.xml"
m = manifest.read_text(encoding="utf-8")
perms = ["INTERNET", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA", "POST_NOTIFICATIONS"]
add = "".join(f'    <uses-permission android:name="android.permission.{p}" />\n' for p in perms if f"permission.{p}\"" not in m)
m = m.replace("</manifest>", add + "</manifest>")
manifest.write_text(m, encoding="utf-8")
gradle = app / "android/app/build.gradle"
g = gradle.read_text(encoding="utf-8")
g = re.sub(r"versionName \"[^\"]+\"", f'versionName "{version}"', g)
if "signingConfigs" not in g:
    g = g.replace("    buildTypes {", """    signingConfigs {
        preview {
            storeFile file(System.getenv('KENT_SIGNING_KEY') ?: 'missing.keystore')
            storePassword 'android'
            keyAlias 'kentyanimda-preview'
            keyPassword 'android'
        }
    }
    buildTypes {""", 1)
    g = g.replace("        release {", "        release {\n            signingConfig signingConfigs.preview", 1)
gradle.write_text(g, encoding="utf-8")
print("android setup applied:", pkg, version)
