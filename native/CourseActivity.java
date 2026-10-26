package app.unlockenglish;

import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Locale;

/** Readable source equivalent of the small SDK-independent bridge emitted by tools/voice_dex.py.
 * The recovered MainActivity bytecode has only its FINAL class flag removed to allow this extension.
 * No microphone is accessed in the background; recording uses a user-launched system speech activity.
 */
public class CourseActivity extends MainActivity implements TextToSpeech.OnInitListener {
    private WebView courseWeb;
    private TextToSpeech speaker;
    private boolean ttsReady;
    private String requestId;

    public static WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWeb(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        courseWeb = findWeb(getWindow().getDecorView());
        if (courseWeb != null) {
            courseWeb.addJavascriptInterface(this, "BookNative");
            // JavaScript interfaces are applied on a new page load.
            courseWeb.loadUrl("file:///android_asset/index.html");
        }
        speaker = new TextToSpeech(this, this);
    }
    @JavascriptInterface public void recognize(String id) {
        runOnUiThread(new VoiceJob(this, id, 0));
    }
    @JavascriptInterface public void speak(String text, boolean slow) {
        runOnUiThread(new VoiceJob(this, text, slow ? 2 : 1));
    }
    @JavascriptInterface public void stopSpeaking() {
        runOnUiThread(new VoiceJob(this, "", 3));
    }
    public void doRecognize(String id) {
        if (id == null) return;
        requestId = id;
        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-GB");
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak in English");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            startActivityForResult(intent, 7041);
        } catch (RuntimeException unavailable) {
            emit("unavailable", "");
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        if (request != 7041) { super.onActivityResult(request, result, data); return; }
        if (result != RESULT_OK || data == null) { emit("cancelled", ""); return; }
        ArrayList<String> words = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (words == null || words.isEmpty() || words.get(0) == null) { emit("no_speech", ""); return; }
        emit("ok", words.get(0));
    }
    public void emit(String status, String text) {
        if (courseWeb == null) return;
        String js = "window.onNativeBookSpeech&&window.onNativeBookSpeech({id:"
                + JSONObject.quote(requestId) + ",status:" + JSONObject.quote(status)
                + ",text:" + JSONObject.quote(text) + "});";
        courseWeb.evaluateJavascript(js, null);
    }
    @Override public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && speaker != null && speaker.setLanguage(Locale.UK) >= 0) ttsReady = true;
    }
    public void doSpeak(String text, boolean slow) {
        if (text == null) return;
        if (!ttsReady || speaker == null) {
            if (courseWeb != null) courseWeb.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('book-speech-notice',{detail:'English voice is not ready. Check the Android text-to-speech settings.'}));", null);
            return;
        }
        if (text.length() > 600) text = text.substring(0, 600);
        speaker.setSpeechRate(slow ? .72f : .95f);
        speaker.speak(text, TextToSpeech.QUEUE_FLUSH, null, "unlock-english-word");
    }
    public void doStop() { if (speaker != null) speaker.stop(); }
    @Override protected void onPause() { doStop(); super.onPause(); }
    @Override protected void onDestroy() { if (speaker != null) speaker.shutdown(); super.onDestroy(); }
}
