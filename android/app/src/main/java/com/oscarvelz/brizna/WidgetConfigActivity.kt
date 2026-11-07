package com.oscarvelz.brizna

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.TextView

/**
 * Widget options (android-6), shown by the launcher when a widget is placed: the appearance (follow the app,
 * always day, always night) and — except on "Semana", which has no totals — whether Por cobrar shows. Choices
 * are per widget id (WidgetLook); saving refreshes that widget and confirms the placement.
 */
class WidgetConfigActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(saved: Bundle?) {
        super.onCreate(saved)
        setResult(RESULT_CANCELED)
        widgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
        val provider = AppWidgetManager.getInstance(this).getAppWidgetInfo(widgetId)?.provider?.className ?: ""
        val isSemana = provider.endsWith("SemanaWidget")

        val pad = (24 * resources.displayMetrics.density).toInt()
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }
        fun text(s: String, size: Float, bold: Boolean = false, top: Int = 0): TextView = TextView(this).apply {
            text = s; textSize = size
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            if (top > 0) (layoutParams ?: LinearLayout.LayoutParams(-1, -2)).also { layoutParams = it }
            setPadding(0, (top * resources.displayMetrics.density).toInt(), 0, 0)
        }
        col.addView(text("Widget de Brizna", 19f, bold = true))
        col.addView(text("Apariencia", 14f, bold = true, top = 18))
        val group = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        val current = WidgetLook.lookOverride(this, widgetId)
        val rbApp = RadioButton(this).apply { text = "Como la app"; id = 1 }
        val rbDay = RadioButton(this).apply { text = "Siempre día"; id = 2 }
        val rbNight = RadioButton(this).apply { text = "Siempre noche"; id = 3 }
        group.addView(rbApp); group.addView(rbDay); group.addView(rbNight)
        group.check(when (current) { "day" -> 2; "night" -> 3; else -> 1 })
        col.addView(group)
        var owed: CheckBox? = null
        if (!isSemana) {
            owed = CheckBox(this).apply {
                text = "Mostrar Por cobrar"
                isChecked = WidgetLook.showOwed(this@WidgetConfigActivity, widgetId)
                setPadding(0, (14 * resources.displayMetrics.density).toInt(), 0, 0)
            }
            col.addView(owed)
        }
        val save = Button(this).apply {
            text = "Guardar"
            setOnClickListener {
                WidgetLook.setLook(this@WidgetConfigActivity, widgetId, when (group.checkedRadioButtonId) {
                    2 -> "day"; 3 -> "night"; else -> null
                })
                owed?.let { WidgetLook.setShowOwed(this@WidgetConfigActivity, widgetId, it.isChecked) }
                when {
                    provider.endsWith("HoyWidget") -> HoyWidget.refresh(this@WidgetConfigActivity)
                    provider.endsWith("PanelWidget") -> PanelWidget.refresh(this@WidgetConfigActivity)
                    provider.endsWith("SemanaWidget") -> SemanaWidget.refresh(this@WidgetConfigActivity)
                }
                setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                finish()
            }
        }
        val lp = LinearLayout.LayoutParams(-1, -2).apply {
            topMargin = (20 * resources.displayMetrics.density).toInt()
            gravity = Gravity.END
        }
        col.addView(save, lp)
        setContentView(col)
    }
}
