/* ===== تنبيهات الصلاة الأصلية (Capacitor Local Notifications) =====
   تُجدول الصلوات الخمس (ومعالجة الجمعة) للأيام القادمة وتنطلق والتطبيق مغلق، بصوت أذان. */
(function () {
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;          // native only
    var LN = C.Plugins && C.Plugins.LocalNotifications;
    var APP = C.Plugins && C.Plugins.App;
    if (!LN) return;

    function localTime(base, hoursDec) {          // base = local midnight Date
      var d = new Date(base.getTime());
      d.setHours(0, 0, 0, 0);
      d.setMinutes(Math.round(hoursDec * 60));
      return d;
    }
    function buildList() {
      var out = [], now = new Date(), DAYS = 14, off = (S.firstAdhanMin || 30) / 60, c = prayCoords();
      for (var i = 0; i < DAYS; i++) {
        var base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        var dtU = dayUTC(base.getFullYear(), base.getMonth(), base.getDate());
        var h = gregToHijri(dtU), t = prayerTimesFor(h, dtU), fri = base.getDay() === 5;
        var rows = [];
        rows.push([t.fajr, 'الفجر']);
        if (fri) { rows.push([t.dhuhr - off, 'الأذان الأول · الجمعة']); rows.push([t.dhuhr, 'الجمعة · الخطبة']); }
        else rows.push([t.dhuhr, 'الظهر']);
        rows.push([t.asr, 'العصر']); rows.push([t.maghrib, 'المغرب']); rows.push([t.isha, 'العشاء']);
        for (var r = 0; r < rows.length; r++) {
          var at = localTime(base, rows[r][0]);
          if (at.getTime() > now.getTime() + 60000) out.push({ at: at, name: rows[r][1], city: c.n });
        }
      }
      out.sort(function (a, b) { return a.at - b.at; });
      return out.slice(0, 58).map(function (x, idx) {
        return {
          id: idx + 1,
          title: '🕌 ' + x.name,
          body: 'حان الآن وقت ' + x.name + ' — ' + x.city,
          schedule: { at: x.at, allowWhileIdle: true },
          channelId: 'prayer',
          sound: 'adhan.wav',
          smallIcon: 'ic_stat_name'
        };
      });
    }
    async function ensurePerm() {
      try {
        var p = await LN.checkPermissions();
        if (p.display !== 'granted') p = await LN.requestPermissions();
        return p.display === 'granted';
      } catch (e) { return false; }
    }
    async function reschedule() {
      try {
        if (typeof S === 'undefined' || !S.prOn) return;
        if (!(await ensurePerm())) return;
        if (LN.createChannel) {
          try { await LN.createChannel({ id: 'prayer', name: 'أوقات الصلاة', description: 'تنبيهات أوقات الصلاة', importance: 5, sound: 'adhan.wav', visibility: 1, vibration: true }); } catch (e) {}
        }
        try {
          var pend = await LN.getPending();
          if (pend && pend.notifications && pend.notifications.length)
            await LN.cancel({ notifications: pend.notifications.map(function (n) { return { id: n.id }; }) });
        } catch (e) {}
        var list = buildList();
        if (list.length) await LN.schedule({ notifications: list });
      } catch (e) {}
    }
    var doneBtn = document.getElementById('prayDone');
    if (doneBtn) doneBtn.addEventListener('click', function () { setTimeout(reschedule, 400); });
    // reschedule on launch and whenever app returns to foreground
    reschedule();
    if (APP && APP.addListener) APP.addListener('resume', reschedule);
    window.__rescheduleAdhan = reschedule; // allow manual trigger after settings change
  });
})();
