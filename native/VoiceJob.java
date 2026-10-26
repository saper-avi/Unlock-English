package app.unlockenglish;

/** Explicit Runnable avoids adding desugaring/runtime dependencies to the recovered shell. */
public class VoiceJob implements Runnable {
    private CourseActivity activity;
    private String text;
    private int mode;
    public VoiceJob(CourseActivity activity, String text, int mode) {
        this.activity = activity; this.text = text; this.mode = mode;
    }
    @Override public void run() {
        if (mode == 0) activity.doRecognize(text);
        else if (mode == 3) activity.doStop();
        else activity.doSpeak(text, mode == 2);
    }
}
