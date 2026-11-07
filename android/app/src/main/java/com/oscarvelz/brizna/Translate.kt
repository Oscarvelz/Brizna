package com.oscarvelz.brizna

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import org.json.JSONObject

/**
 * android-3 (web 1.5.04): "A inglés" on the phone with Google ML Kit, free and with no key.
 * The Spanish model (~30 MB) downloads the first time, on any network (Wi-Fi or data), and stays on the phone;
 * after that translation works with no internet. Only the message text is translated, all on the device.
 * Replies go to the page as CustomEvent "briznanative-translate" {id, state:"downloading"} then {id, ok, text|error}.
 */
class Translate(private val ctx: Context, private val reply: (JSONObject) -> Unit) {
    private var made: Translator? = null
    private val client: Translator
        get() = made ?: Translation.getClient(
            TranslatorOptions.Builder()
                .setSourceLanguage(TranslateLanguage.SPANISH)
                .setTargetLanguage(TranslateLanguage.ENGLISH)
                .build()
        ).also { made = it }
    private val spanish = TranslateRemoteModel.Builder(TranslateLanguage.SPANISH).build()
    @Volatile private var have = false

    /** "ready" when the Spanish model is on the phone, "missing" when the first use will download it. */
    fun state(): String = if (have) "ready" else "missing"

    fun check() {
        runCatching {
            RemoteModelManager.getInstance().isModelDownloaded(spanish).addOnSuccessListener { have = it == true }
        }
    }

    fun run(id: String, text: String) {
        val t = text.take(2000)
        if (t.isBlank()) { reply(fail(id, "failed")); return }
        try {
            RemoteModelManager.getInstance().isModelDownloaded(spanish).addOnCompleteListener { task ->
                val ready = task.isSuccessful && task.result == true
                if (ready) { have = true; go(id, t); return@addOnCompleteListener }
                if (!online()) { reply(fail(id, "offline")); return@addOnCompleteListener }
                reply(JSONObject().put("id", id).put("state", "downloading"))
                // any network: Oscar is often on mobile data in the field; the model is downloaded once and kept
                client.downloadModelIfNeeded(DownloadConditions.Builder().build())
                    .addOnSuccessListener { have = true; go(id, t) }
                    .addOnFailureListener { reply(fail(id, if (online()) "failed" else "offline")) }
            }
        } catch (e: Exception) {
            reply(fail(id, "failed"))
        }
    }

    private fun go(id: String, text: String) {
        client.translate(text)
            .addOnSuccessListener { out -> reply(JSONObject().put("id", id).put("ok", true).put("text", out ?: "")) }
            .addOnFailureListener { reply(fail(id, "failed")) }
    }

    private fun fail(id: String, why: String) = JSONObject().put("id", id).put("ok", false).put("error", why)

    private fun online(): Boolean = runCatching {
        val cm = ctx.getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }.getOrDefault(true)

    fun close() { runCatching { made?.close() }; made = null }
}
