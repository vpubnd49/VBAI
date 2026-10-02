package com.vbai.legalpro;

import android.Manifest;
import android.app.Dialog;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Message;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {
    private static final int REQUEST_MICROPHONE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Yêu cầu quyền micro lúc runtime (Android 6.0+)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    REQUEST_MICROPHONE);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setSupportMultipleWindows(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);

            // Cho phep co gian (pinch-to-zoom) tren toan bo giao dien app
            settings.setSupportZoom(true);
            settings.setBuiltInZoomControls(true);
            settings.setDisplayZoomControls(false);

            // Cho phep WebView su dung MediaRecorder
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Loai bo "; wv" khoi User-Agent de Google OAuth khong chan embedded WebView
            String ua = settings.getUserAgentString();
            if (ua != null && ua.contains("; wv")) {
                settings.setUserAgentString(ua.replace("; wv", ""));
            }

            // Xu ly cua so popup Google Auth mo ngay trong Dialog app, khong mo trinh duyet ngoai
            webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {

                // ★ Cho phép WebView truy cập micro khi JS gọi getUserMedia()
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        String[] resources = request.getResources();
                        for (String resource : resources) {
                            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                                // Chỉ grant nếu app đã được cấp quyền RECORD_AUDIO ở runtime
                                if (ContextCompat.checkSelfPermission(MainActivity.this,
                                        Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                                } else {
                                    request.deny();
                                }
                                return;
                            }
                        }
                        // Cho phep tat ca cac quyen WebView khac (VD: camera neu can sau nay)
                        request.grant(resources);
                    });
                }

                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    WebView newWebView = new WebView(MainActivity.this);
                    WebSettings newSettings = newWebView.getSettings();
                    newSettings.setJavaScriptEnabled(true);
                    newSettings.setDomStorageEnabled(true);
                    newSettings.setSupportMultipleWindows(true);
                    newSettings.setJavaScriptCanOpenWindowsAutomatically(true);

                    String subUa = newSettings.getUserAgentString();
                    if (subUa != null && subUa.contains("; wv")) {
                        newSettings.setUserAgentString(subUa.replace("; wv", ""));
                    }

                    final Dialog dialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                    dialog.setContentView(newWebView);
                    dialog.show();

                    newWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                            return false;
                        }
                    });

                    newWebView.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onCloseWindow(WebView window) {
                            dialog.dismiss();
                        }
                    });

                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(newWebView);
                    resultMsg.sendToTarget();
                    return true;
                }
            });
        }
    }
}
