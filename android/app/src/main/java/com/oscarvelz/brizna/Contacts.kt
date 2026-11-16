package com.oscarvelz.brizna

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract
import org.json.JSONArray
import org.json.JSONObject

/**
 * android-11: "Del teléfono" — adding a client from the phone's contacts.
 *
 * The web app used the Web Contacts API (navigator.contacts), but inside a WebView that picker is
 * broken on real phones: select() exists, the user picks someone, and the promise still rejects —
 * the page could only report "No se eligió ningún contacto" about a contact that WAS chosen.
 * So the shell does the picking itself, the same way Dictate does the listening: the system's own
 * contact picker opens (Intent.ACTION_PICK over the Phone table — the user chooses a NUMBER,
 * which is what a client needs) and Brizna reads ONLY the entry that was picked. The temporary
 * grant that travels back with the pick result covers that one row: Brizna never asks for
 * READ_CONTACTS and never sees the rest of the address book.
 *
 * The postal address is best-effort: some phones refuse the postal row without the full contacts
 * permission, and the form already invites completing the address by hand. With `multiple`, the
 * picker reopens after each pick until the user backs out; what was gathered is delivered, and
 * backing out with nothing is a cancellation, not an error.
 *
 * Replies go back as one "briznanative-contacts" event per ask:
 * { id, ok: true, contacts: [{ name: [..], tel: [..], address: [{ addressLine: [..] }] }] }
 * (the Web Contacts API shape, so the page maps it with the code it already had), or
 * { id, ok: false, error: "cancelled" | "failed" | "busy" }.
 */
class ContactPicker(private val ctx: Context, private val reply: (JSONObject) -> Unit) {

    /** Set by MainActivity: launches the picker intent for a result. False when no app can answer. */
    var launch: ((Intent) -> Boolean)? = null

    private var id: String? = null
    private var multiple = false
    private var picked = JSONArray()

    fun start(newId: String, multi: Boolean) {
        if (id != null) {
            reply(JSONObject().put("id", newId).put("ok", false).put("error", "busy"))
            return
        }
        id = newId
        multiple = multi
        picked = JSONArray()
        if (!openPicker()) finish("failed")
    }

    /** MainActivity's onActivityResult hands the picker's answer here. */
    fun onResult(ok: Boolean, data: Intent?) {
        if (id == null) return
        val uri = if (ok) data?.data else null
        if (uri == null) {
            // The user backed out: with several picks, what was gathered still counts.
            if (picked.length() > 0) finish(null) else finish("cancelled")
            return
        }
        val contact = read(uri)
        if (contact == null) {
            if (picked.length() > 0) finish(null) else finish("failed")
            return
        }
        picked.put(contact)
        if (multiple) {
            if (!openPicker()) finish(null)
        } else {
            finish(null)
        }
    }

    /** The page stopped waiting (its own timeout): forget the ask; a late answer is dropped. */
    fun cancel() {
        id = null
    }

    private fun openPicker(): Boolean {
        val intent = Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)
        return launch?.invoke(intent) ?: false
    }

    private fun finish(error: String?) {
        val cur = id ?: return
        id = null
        if (error != null) {
            reply(JSONObject().put("id", cur).put("ok", false).put("error", error))
        } else {
            reply(JSONObject().put("id", cur).put("ok", true).put("contacts", picked))
        }
    }

    /** Reads the picked phone row: display name + number, plus the postal address when the phone allows it. */
    private fun read(uri: Uri): JSONObject? = runCatching {
        val cr = ctx.contentResolver
        var name = ""
        var number = ""
        var contactId = ""
        cr.query(
            uri,
            arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ),
            null, null, null,
        )?.use { c ->
            if (c.moveToFirst()) {
                name = c.getString(0) ?: ""
                number = c.getString(1) ?: ""
                contactId = c.getString(2) ?: ""
            }
        }
        if (name.isBlank() && number.isBlank()) return null
        val address = JSONObject()
        if (contactId.isNotBlank()) {
            runCatching {
                cr.query(
                    ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_URI,
                    arrayOf(ContactsContract.CommonDataKinds.StructuredPostal.FORMATTED_ADDRESS),
                    ContactsContract.CommonDataKinds.StructuredPostal.CONTACT_ID + " = ?",
                    arrayOf(contactId),
                    null,
                )?.use { c ->
                    if (c.moveToFirst()) {
                        val formatted = c.getString(0) ?: ""
                        if (formatted.isNotBlank()) {
                            address.put("addressLine", JSONArray().put(formatted.replace("\n", ", ")))
                        }
                    }
                }
            }
        }
        JSONObject()
            .put("name", JSONArray().put(name.ifBlank { number }))
            .put("tel", JSONArray().put(number))
            .put("address", JSONArray().put(address))
    }.getOrNull()
}
