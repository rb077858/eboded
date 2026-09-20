(function(){
  'use strict';
  document.documentElement.lang = 'he';
  document.documentElement.dir = 'rtl';

  var DEPARTMENTS = ["אורתופדית","כירורגית א׳","כירורגית ב׳","נשים ויולדות","פנימית א׳","פנימית ב׳","פנימית ג׳","פנימית ד׳","ילדים","גריאטריה","אחר"];
  var LANGUAGES = ["עברית","ערבית","אנגלית","רוסית","אמהרית","ספרדית","צרפתית"];
  var ROLE_LABELS = {admin:'אדמין ראשי', manager:'מנהל/ת מחלקה', volunteer:'מתנדב/ת'};

  // ---------------- firebase init ----------------
  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();
  var secondaryApp = null;
  function getSecondaryAuth(){
    if(!secondaryApp){
      secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
    }
    return secondaryApp.auth();
  }

  var appEl = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  var state = {
    ready: false,          // has the initial auth check resolved
    authUser: null,        // firebase auth user
    profile: null,         // users/{uid} doc data
    profileLoaded: false,
    loginMode: 'login',    // 'login' | 'register'
    stack: [],
    volunteers: [],
    volunteersLoaded: false,
    requests: [],
    requestsLoaded: false,
    feedbackDrafts: {},
    feedbackChoice: {},
    newManagerBusy: false,
    busy: {}
  };

  var unsubProfile = null, unsubRequests = null, unsubVolunteers = null;

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 3200);
  }
  function fmtDT(iso){
    if(!iso) return '';
    try{ return new Date(iso).toLocaleString('he-IL', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}); }
    catch(e){ return ''; }
  }
  function hoursBetween(a,b){
    if(!a || !b) return 0;
    var ms = new Date(b).getTime() - new Date(a).getTime();
    if (isNaN(ms) || ms<=0) return 0;
    return Math.round((ms/3600000)*10)/10;
  }
  function authErrorMsg(err){
    var code = err && err.code || '';
    var map = {
      'auth/email-already-in-use': 'כבר קיים חשבון עם האימייל הזה — נסו להתחבר במקום להירשם',
      'auth/invalid-email': 'כתובת אימייל לא תקינה',
      'auth/weak-password': 'הסיסמה חלשה מדי — לפחות 6 תווים',
      'auth/wrong-password': 'סיסמה שגויה',
      'auth/invalid-credential': 'אימייל או סיסמה שגויים',
      'auth/invalid-login-credentials': 'אימייל או סיסמה שגויים',
      'auth/user-not-found': 'לא נמצא חשבון עם האימייל הזה',
      'auth/too-many-requests': 'יותר מדי ניסיונות — נסו שוב בעוד כמה דקות',
      'auth/popup-closed-by-user': 'החלון נסגר לפני השלמת ההתחברות'
    };
    return map[code] || (err && err.message) || 'משהו השתבש, נסו שוב';
  }

  function islandSvg(size){
    size = size || 96;
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="156" cy="38" r="14" fill="none" stroke="var(--accent)" stroke-width="2.5"/>' +
      '<path d="M156 14 L156 22 M180 38 L172 38 M175 17 L169 23 M137 17 L143 23" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>' +
      '<ellipse cx="100" cy="164" rx="82" ry="20" fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="2"/>' +
      '<path d="M100 164 C 96 120, 108 90, 120 56" stroke="var(--accent)" stroke-width="6" fill="none" stroke-linecap="round"/>' +
      '<g stroke="var(--primary)" stroke-width="5" stroke-linecap="round" fill="none">' +
      '<path d="M120 56 C 96 44, 72 46, 54 62"/>' +
      '<path d="M120 56 C 100 32, 78 22, 58 20"/>' +
      '<path d="M120 56 C 116 26, 122 10, 132 -2"/>' +
      '<path d="M120 56 C 138 30, 156 20, 174 18"/>' +
      '<path d="M120 56 C 144 42, 164 42, 182 56"/>' +
      '</g></svg>';
  }
  function backArrowSvg(){ return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function plusSvg(){ return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }
  function statsSvg(){ return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20V14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function personSvg(){ return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="2"/><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'; }
  function gearSvg(){ return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.04 1.56V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1.04-1.56 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.04H3a2 2 0 010-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001.04-1.56V3a2 2 0 014 0v.09A1.7 1.7 0 0015 4.6a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 001.56 1.04H21a2 2 0 010 4h-.09A1.7 1.7 0 0019.4 15z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function googleSvg(){ return '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16 4 9.1 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 34.7 26.9 35.7 24 35.7c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9 39.6 15.9 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.6l6.5 5.5C41.6 36.4 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>'; }
  function qrSvg(muted){
    var stroke = muted ? 'var(--muted)' : 'var(--primary)';
    var fill = muted ? 'var(--border)' : 'var(--surface2)';
    return '<svg width="128" height="128" viewBox="0 0 160 160" fill="none">' +
      '<path d="M4 30V8H26" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/><path d="M156 30V8H134" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/><path d="M4 130V152H26" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/><path d="M156 130V152H134" stroke="'+stroke+'" stroke-width="4" stroke-linecap="round"/>' +
      '<g fill="'+fill+'"><rect x="34" y="34" width="10" height="10"/><rect x="50" y="34" width="10" height="10"/><rect x="74" y="34" width="10" height="10"/><rect x="98" y="34" width="10" height="10"/><rect x="116" y="34" width="10" height="10"/><rect x="34" y="50" width="10" height="10"/><rect x="66" y="50" width="10" height="10"/><rect x="90" y="50" width="10" height="10"/><rect x="116" y="50" width="10" height="10"/><rect x="34" y="74" width="10" height="10"/><rect x="58" y="74" width="10" height="10"/><rect x="74" y="74" width="10" height="10"/><rect x="98" y="74" width="10" height="10"/><rect x="116" y="74" width="10" height="10"/><rect x="42" y="98" width="10" height="10"/><rect x="66" y="98" width="10" height="10"/><rect x="90" y="98" width="10" height="10"/><rect x="116" y="98" width="10" height="10"/><rect x="34" y="116" width="10" height="10"/><rect x="58" y="116" width="10" height="10"/><rect x="82" y="116" width="10" height="10"/><rect x="106" y="116" width="10" height="10"/></g></svg>';
  }

  // ---------------- navigation ----------------
  function myRole(){ return state.profile ? state.profile.role : null; }
  function isAdmin(){ return myRole()==='admin'; }
  function isManager(){ return myRole()==='manager' || isAdmin(); }
  function homeScreen(){ return myRole()==='volunteer' ? 'openRequests' : 'volunteerList'; }
  function goHome(){ state.stack = [{screen: homeScreen(), params:{}}]; render(); }
  function push(screen, params){ state.stack.push({screen:screen, params: params||{}}); render(); }
  function replaceTop(screen, params){ state.stack[state.stack.length-1] = {screen:screen, params: params||{}}; render(); }
  function goBack(){
    if(state.stack.length>1){ state.stack.pop(); render(); }
    else { goHome(); }
  }

  function header(title, opts){
    opts = opts || {};
    var left = opts.back ? '<button class="icon-btn" data-action="nav-back" aria-label="חזרה">'+backArrowSvg()+'</button>' : '<span class="icon-spacer"></span>';
    var right = opts.actions ? '<div class="scr-actions">'+opts.actions+'</div>' : '<span class="icon-spacer"></span>';
    return '<div class="scr-header"><div class="scr-header-row">'+left+'<h1 class="scr-title">'+esc(title)+'</h1>'+right+'</div>'+
      (opts.sub ? '<span class="scr-sub">'+esc(opts.sub)+'</span>' : '') + '</div>';
  }
  function wrapScreen(headerHtml, bodyHtml){
    return headerHtml + '<div class="view-body">' + bodyHtml + '</div>';
  }
  function statusLabel(status){
    var labels = {open:'פתוחה', claimed:'שובצה', checked_in:'בביקור כעת', checked_out:'הביקור הסתיים', done:'הושלם'};
    return labels[status] || status;
  }
  function statusBadge(status){ return '<span class="badge badge-'+status+'">'+statusLabel(status)+'</span>'; }
  function roleBadge(role){ return '<span class="role-badge role-'+role+'">'+esc(ROLE_LABELS[role]||role)+'</span>'; }

  // ---------------- render dispatch ----------------
  function render(){
    var view = document.getElementById('view');
    view.classList.remove('loading-screen');

    if(!state.ready){
      view.innerHTML = '<span>טוען…</span>';
      view.classList.add('loading-screen');
      return;
    }
    if(!state.authUser){
      view.innerHTML = screenLogin();
      return;
    }
    if(!state.profileLoaded || !state.profile){
      view.innerHTML = '<span>טוען פרופיל…</span>';
      view.classList.add('loading-screen');
      return;
    }
    var top = state.stack[state.stack.length-1];
    if(!top){ top = {screen: homeScreen(), params:{}}; state.stack=[top]; }
    var body = '';
    switch(top.screen){
      case 'openRequests': body = screenOpenRequests(); break;
      case 'volunteerList': body = screenVolunteerList(); break;
      case 'manageUsers': body = screenManageUsers(); break;
      case 'profile': body = screenProfile(top.params); break;
      case 'sendRequest': body = screenSendRequest(top.params); break;
      case 'scan': body = screenScan(top.params); break;
      case 'feedback': body = screenFeedback(top.params); break;
      case 'hours': body = screenHours(); break;
      default: body = screenOpenRequests();
    }
    view.innerHTML = body;
  }

  // ================= SCREEN — login / register =================
  function screenLogin(){
    var isReg = state.loginMode==='register';
    return (
      '<div class="login-wrap">' +
        islandSvg(110) +
        '<div class="login-brand">אי בודד</div>' +
        '<p class="login-tag">מתנדבים ביחד &mdash; אף אחד לא לבד</p>' +
        '<div class="login-mode-toggle">' +
          '<button type="button" class="rtoggle '+(!isReg?'active':'')+'" data-action="set-login-mode" data-mode="login">כניסה</button>' +
          '<button type="button" class="rtoggle '+(isReg?'active':'')+'" data-action="set-login-mode" data-mode="register">הרשמת מתנדב/ת חדש/ה</button>' +
        '</div>' +
        '<form class="login-card" data-form="login">' +
          (isReg ? '<div class="field"><label for="li-name">שם מלא</label><input id="li-name" name="name" type="text" placeholder="השם המלא שלך" required></div>' : '') +
          '<div class="field"><label for="li-email">אימייל</label><input id="li-email" name="email" type="email" placeholder="name@example.com" required autocomplete="email"></div>' +
          '<div class="field"><label for="li-pass">סיסמה</label><input id="li-pass" name="pass" type="password" placeholder="לפחות 6 תווים" required autocomplete="'+(isReg?'new-password':'current-password')+'"></div>' +
          '<button type="submit" class="btn btn-primary btn-block">'+(isReg?'הרשמה':'התחברות')+'</button>' +
          (!isReg ? '<button type="button" class="link-btn" data-action="forgot-pass" style="align-self:center;">שכחתי סיסמה</button>' : '') +
        '</form>' +
        '<div class="or-sep" style="width:100%; margin:2px 0;">או</div>' +
        '<button type="button" class="btn btn-google btn-block" data-action="google-login">'+googleSvg()+'<span>המשך עם Google</span></button>' +
        (isReg ? '<p class="hint" style="margin-top:8px;">הרשמה עצמית פתוחה למתנדבים. חשבונות מנהלי מחלקה נוצרים על ידי האדמין הראשי בלבד.</p>' : '') +
        '<div class="login-foot">בית חולים איכילוב &middot; מחלקת התנדבות</div>' +
      '</div>'
    );
  }

  // ================= SCREEN — open requests (volunteer home) =================
  function myActiveVisit(){
    if(myRole()!=='volunteer') return null;
    return state.requests.find(function(r){
      return r.claimedByUid===state.authUser.uid && (r.status==='claimed' || r.status==='checked_in');
    }) || null;
  }
  function screenOpenRequests(){
    var actions = '<button class="icon-btn" data-action="go-my-profile" aria-label="הפרופיל שלי">'+personSvg()+'</button>';
    var html = header('בקשות פתוחות', {actions:actions, sub:'חולים שממתינים לביקור — בחרו את הבקשה שמתאימה לכם'});
    var body = '';
    var active = myActiveVisit();
    if(active){
      body += '<div class="banner-active"><span style="flex-grow:1; font-size:13px;">יש לך ביקור פעיל אצל <b>'+esc(active.patientLabel||'')+'</b> &middot; '+statusLabel(active.status)+'</span><button class="btn btn-primary" data-action="resume-visit" data-id="'+active.id+'">המשך</button></div>';
    }
    if(!state.requestsLoaded){
      body += '<div class="empty"><b>טוען בקשות…</b></div>';
    } else {
      var open = state.requests.filter(function(r){ return r.status==='open'; });
      if(open.length===0){
        body += '<div class="empty">🌊<b>אין כרגע בקשות פתוחות</b><span>כשתיפתח בקשה חדשה מהמחלקות היא תופיע כאן.</span></div>';
      } else {
        body += open.map(function(r){
          var busy = !!state.busy['claim-'+r.id];
          return requestCard(r, '<button class="btn btn-primary btn-block" data-action="claim-request" data-id="'+r.id+'" '+(busy?'disabled':'')+'>'+(busy?'משבצים…':'אני מתנדב/ת בבקשה זו')+'</button>');
        }).join('');
      }
    }
    return wrapScreen(html, body);
  }
  function requestCard(r, inner){
    var langChip = r.language ? '<span class="chip chip-primary">שפה: '+esc(r.language)+'</span>' : '';
    var genderTxt = r.gender==='female' ? 'אישה' : (r.gender==='male' ? 'גבר' : '');
    return (
      '<div class="card">' +
        '<div class="card-row"><span class="card-title">'+esc(r.department||'')+'</span><span class="spacer"></span>'+statusBadge(r.status)+'</div>' +
        '<div class="card-row">' +
          (r.patientLabel? '<span class="chip">מזהה: '+esc(r.patientLabel)+'</span>' : '') +
          (genderTxt || r.age ? '<span class="chip chip-accent">'+esc(genderTxt)+(r.age?(genderTxt?' &middot; ':'')+'בן/בת '+esc(String(r.age)):'')+'</span>' : '') +
          langChip +
        '</div>' +
        (r.note ? '<p class="small">'+esc(r.note)+'</p>' : '') +
        (inner || '') +
      '</div>'
    );
  }

  // ================= SCREEN — volunteer list (staff home) =================
  function screenVolunteerList(){
    var actions = '<button class="icon-btn" data-action="new-request" aria-label="בקשה חדשה">'+plusSvg()+'</button>' +
                  '<button class="icon-btn" data-action="go-hours" aria-label="סיכום שעות">'+statsSvg()+'</button>' +
                  (isManager() ? '<button class="icon-btn" data-action="go-manage-users" aria-label="ניהול משתמשים">'+gearSvg()+'</button>' : '');
    var html = header('רשימת המתנדבים', {actions:actions});
    var body = '<div class="banner-info">בלחיצה על שם מתנדב/ת ייפתח הפרופיל המלא &mdash; חשוף לצוות בלבד</div>';
    var activeList = state.volunteers.filter(function(v){ return !v.disabled; });
    if(!state.volunteersLoaded){
      body += '<div class="empty"><b>טוען מתנדבים…</b></div>';
    } else if(activeList.length===0){
      body += '<div class="empty">🧑‍🤝‍🧑<b>עדיין אין מתנדבים רשומים</b><span>ברגע שמתנדב/ת יירשם/תירשם, השם יופיע כאן.</span></div>';
    } else {
      var rows = activeList.map(function(v){
        var active = state.requests.some(function(r){ return r.claimedByUid===v.uid && (r.status==='claimed'||r.status==='checked_in'); });
        return '<button type="button" class="vrow-main" data-action="open-profile" data-id="'+v.uid+'" style="width:100%;">' +
          '<div class="avatar">'+esc((v.name||'?').charAt(0))+'</div>' +
          '<span class="name" style="flex-grow:1;">'+esc(v.name||'')+'</span>' +
          '<span class="dot '+(active?'dot-on':'dot-off')+'"></span>' +
        '</button>';
      }).join('');
      body += '<div class="card-flat" style="padding:4px 12px;">'+rows+'</div>';
      body += '<p class="small" style="text-align:center;">&#9679; מתנדב/ת בביקור פעיל כרגע</p>';
    }
    return wrapScreen(html, body);
  }

  // ================= SCREEN — manage users (admin / manager) =================
  function screenManageUsers(){
    var html = header('ניהול משתמשים', {back:true, sub: isAdmin() ? 'אדמין ראשי — שליטה מלאה' : 'מנהל/ת מחלקה — ניהול מתנדבים'});
    var body = '';
    if(isAdmin()){
      body += '<div class="card-flat">' +
        '<span class="card-title" style="font-size:15px;">יצירת חשבון מנהל/ת מחלקה</span>' +
        '<p class="hint">רק האדמין הראשי יכול ליצור חשבונות מנהל/ת מחלקה. המנהל/ת החדש/ה יקבל/תקבל אימייל וסיסמה שתגדירו כאן.</p>' +
        '<form data-form="new-manager">' +
          '<div class="field"><label for="nm-name">שם מלא</label><input id="nm-name" name="name" type="text" required></div>' +
          '<div class="field" style="margin-top:10px;"><label for="nm-email">אימייל</label><input id="nm-email" name="email" type="email" required></div>' +
          '<div class="field" style="margin-top:10px;"><label for="nm-pass">סיסמה זמנית</label><input id="nm-pass" name="pass" type="password" placeholder="לפחות 6 תווים" required></div>' +
          '<button type="submit" class="btn btn-accent btn-block" style="margin-top:12px;" '+(state.newManagerBusy?'disabled':'')+'>'+(state.newManagerBusy?'יוצרים חשבון…':'יצירת מנהל/ת מחלקה')+'</button>' +
        '</form>' +
      '</div>';
    }
    if(!state.volunteersLoaded){
      body += '<div class="empty"><b>טוען משתמשים…</b></div>';
    } else {
      var users = state.volunteers.slice().sort(function(a,b){
        var order = {admin:0, manager:1, volunteer:2};
        return (order[a.role]||9)-(order[b.role]||9) || (a.name||'').localeCompare(b.name||'', 'he');
      });
      body += '<div class="card-flat" style="padding:6px 14px;">' + users.map(function(v){
        return manageUserRow(v);
      }).join('<div class="divider"></div>') + '</div>';
    }
    return wrapScreen(html, body);
  }
  function manageUserRow(v){
    var isSelf = state.authUser && v.uid===state.authUser.uid;
    var controls = '';
    var canManageThis = isAdmin() ? true : (isManager() && v.role==='volunteer');
    if(canManageThis && !isSelf){
      if(v.disabled){
        controls += '<button type="button" class="btn btn-sm btn-outline" data-action="enable-user" data-id="'+v.uid+'">שחזור חשבון</button>';
      } else {
        controls += '<button type="button" class="btn btn-sm btn-danger" data-action="disable-user" data-id="'+v.uid+'">'+(v.role==='volunteer'?'מחיקת מתנדב/ת':'השבתה')+'</button>';
      }
    }
    if(isAdmin() && !isSelf){
      if(v.role==='volunteer'){
        controls += '<button type="button" class="btn btn-sm btn-outline" data-action="set-role" data-id="'+v.uid+'" data-role="manager">הפוך/הפכי למנהל/ת</button>';
      } else if(v.role==='manager'){
        controls += '<button type="button" class="btn btn-sm btn-outline" data-action="set-role" data-id="'+v.uid+'" data-role="volunteer">הורדה למתנדב/ת</button>';
        controls += '<button type="button" class="btn btn-sm btn-outline" data-action="set-role" data-id="'+v.uid+'" data-role="admin">מינוי לאדמין ראשי</button>';
      } else if(v.role==='admin'){
        controls += '<button type="button" class="btn btn-sm btn-outline" data-action="set-role" data-id="'+v.uid+'" data-role="manager">הורדה למנהל/ת מחלקה</button>';
      }
    }
    return '<div class="vrow" style="align-items:flex-start; flex-wrap:wrap;">' +
      '<div class="avatar">'+esc((v.name||'?').charAt(0))+'</div>' +
      '<div style="display:flex; flex-direction:column; gap:4px; flex-grow:1; min-width:120px;">' +
        '<div class="card-row" style="gap:6px;"><span style="font-weight:700; font-size:14.5px;">'+esc(v.name||'')+(isSelf?' (את/ה)':'')+'</span>'+roleBadge(v.role)+(v.disabled?'<span class="chip chip-danger">מושבת/ת</span>':'')+'</div>' +
        '<span class="small">'+esc(v.email||'')+'</span>' +
        (controls ? '<div class="card-row" style="margin-top:4px;">'+controls+'</div>' : '') +
      '</div>' +
    '</div>';
  }

  // ================= SCREEN — volunteer profile =================
  function screenProfile(params){
    var uid = params.uid;
    var mode = params.mode || 'view';
    var isSelf = mode==='self';
    var v = state.volunteers.find(function(x){ return x.uid===uid; });
    var html = header(isSelf ? 'הפרופיל שלי' : 'פרופיל מתנדב/ת', {back:true});
    if(!v){
      return wrapScreen(html, '<div class="card-flat"><p class="small">טוען פרופיל…</p></div>');
    }
    var active = state.requests.some(function(r){ return r.claimedByUid===v.uid && (r.status==='claimed'||r.status==='checked_in'); });
    var body = '<div class="card-flat" style="align-items:center; text-align:center;">' +
      '<div class="avatar avatar-lg">'+esc((v.name||'?').charAt(0))+'</div>' +
      '<span class="card-title" style="font-size:22px;">'+esc(v.name||'')+'</span>' +
      roleBadge(v.role) +
      (active ? '<span class="chip chip-primary">&#9679; פעיל/ה כעת</span>' : '') +
    '</div>';

    if(isSelf){
      var langs = v.languages || [];
      body += '<div class="card-flat"><form data-form="edit-profile">' +
        '<div class="field"><label for="ep-name">שם מלא</label><input id="ep-name" name="name" type="text" required value="'+esc(v.name||'')+'"></div>' +
        '<div class="field" style="margin-top:12px;"><label>שפות דוברות</label>' + languageChecks(langs, 'languages') + '</div>' +
        '<div class="field" style="margin-top:12px;"><label for="ep-avail">זמינות</label><input id="ep-avail" name="availability" type="text" placeholder="לדוגמה: ימי שלישי אחר הצהריים" value="'+esc(v.availability||'')+'"></div>' +
        '<div class="field" style="margin-top:12px;"><label for="ep-bio">רקע</label><textarea id="ep-bio" name="bio" rows="3" placeholder="קצת עליי">'+esc(v.bio||'')+'</textarea></div>' +
        '<button type="submit" class="btn btn-primary btn-block" style="margin-top:14px;">שמירת שינויים</button>' +
      '</form></div>';
      body += '<button class="btn btn-outline btn-block" data-action="do-logout">התנתקות מהחשבון</button>';
    } else {
      var langChips = (v.languages||[]).map(function(l){ return '<span class="chip">'+esc(l)+'</span>'; }).join('');
      body += '<div class="card-flat">' +
        '<div style="display:flex; flex-direction:column; gap:8px;"><span class="small" style="font-weight:700;">שפות דוברות</span><div class="card-row">'+(langChips||'<span class="small">לא צויין</span>')+'</div></div>' +
        '<div class="divider"></div>' +
        '<div style="display:flex; flex-direction:column; gap:8px;"><span class="small" style="font-weight:700;">זמינות</span><span style="font-size:14px;">'+esc(v.availability||'לא צויין')+'</span></div>' +
        (v.bio ? '<div class="divider"></div><div style="display:flex; flex-direction:column; gap:8px;"><span class="small" style="font-weight:700;">רקע</span><span style="font-size:14px; line-height:1.55;">'+esc(v.bio)+'</span></div>' : '') +
      '</div>';
      if(v.role==='volunteer' && !v.disabled){
        body += '<button class="btn btn-primary btn-block" data-action="send-to-volunteer" data-id="'+v.uid+'" data-name="'+esc(v.name||'')+'">שליחת בקשת התנדבות</button>';
      }
    }
    return wrapScreen(html, body);
  }
  function languageChecks(selected, name){
    selected = selected || [];
    return '<div class="checks">' + LANGUAGES.map(function(l){
      var checked = selected.indexOf(l)>-1 ? 'checked' : '';
      return '<label class="check-opt"><input type="checkbox" name="'+name+'" value="'+esc(l)+'" '+checked+'>'+esc(l)+'</label>';
    }).join('') + '</div>';
  }

  // ================= SCREEN — send request =================
  function screenSendRequest(params){
    var targeted = !!params.volunteerId;
    var html = header(targeted ? 'שליחת בקשה למתנדב/ת' : 'בקשה חדשה', {back:true});
    var body = '';
    if(targeted){
      body += '<div class="card-row" style="background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:14px 16px; box-shadow:var(--shadow);">' +
        '<div class="avatar">'+esc((params.volunteerName||'?').charAt(0))+'</div>' +
        '<div style="display:flex; flex-direction:column;"><span style="font-size:15.5px; font-weight:700;">'+esc(params.volunteerName||'')+'</span><span class="small">נבחר/ה לבקשה זו</span></div>' +
      '</div>';
    }
    body += '<div class="card-flat"><p class="hint">מזהה החולה יכול להיות מספר חדר או כל תיוג פנימי &mdash; בלי שם מלא, לשמירה על פרטיות.</p>' +
      '<form data-form="send-request">' +
        '<input type="hidden" name="volunteerId" value="'+esc(params.volunteerId||'')+'">' +
        '<input type="hidden" name="volunteerName" value="'+esc(params.volunteerName||'')+'">' +
        '<div class="field"><label for="sr-dept">מחלקה</label><select id="sr-dept" name="department" required>' + DEPARTMENTS.map(function(d){return '<option value="'+esc(d)+'">'+esc(d)+'</option>';}).join('') + '</select></div>' +
        '<div class="field" style="margin-top:12px;"><label for="sr-patient">מזהה חולה (מספר חדר / תיוג)</label><input id="sr-patient" name="patientLabel" type="text" placeholder="לדוגמה: חדר 4, מיטה 2" required></div>' +
        '<div class="card-row" style="margin-top:12px; gap:10px;">' +
          '<div class="field" style="flex:1;"><label for="sr-age">גיל</label><input id="sr-age" name="age" type="number" min="0" max="120" placeholder="גיל" required></div>' +
          '<div class="field" style="flex:1;"><label for="sr-gender">מגדר</label><select id="sr-gender" name="gender" required><option value="female">אישה</option><option value="male">גבר</option></select></div>' +
        '</div>' +
        '<div class="field" style="margin-top:12px;"><label for="sr-lang">שפה מועדפת</label><select id="sr-lang" name="language" required>' + LANGUAGES.map(function(l){return '<option value="'+esc(l)+'">'+esc(l)+'</option>';}).join('') + '</select></div>' +
        '<div class="field" style="margin-top:12px;"><label for="sr-note">'+(targeted?'הודעה אישית':'הערה למתנדב/ת (לא חובה)')+'</label><textarea id="sr-note" name="note" rows="3" placeholder="'+(targeted?'אשמח אם תגיע/י לבקר...':'פרטים שיעזרו למתנדב/ת להתכונן')+'"></textarea></div>' +
        (targeted ? '<div class="card-row" style="margin-top:4px;"><span style="color:var(--accent); font-size:16px;">&#10084;</span><span class="small">מעריכים מאוד את הזמן שאת/ה תורמ/ת</span></div>' : '') +
        '<button type="submit" class="btn btn-primary btn-block" style="margin-top:14px;">'+(targeted?'שליחת הבקשה':'פרסום הבקשה')+'</button>' +
      '</form>' +
    '</div>';
    return wrapScreen(html, body);
  }

  // ================= SCREEN — scan check-in / check-out =================
  function screenScan(params){
    var r = state.requests.find(function(x){ return x.id===params.requestId; });
    var html = header('סריקת קוד ביקור', {back:true, sub: r ? ('ביקור אצל '+(r.patientLabel||'')+' &middot; מחלקה '+(r.department||'')) : ''});
    if(!r){
      return wrapScreen(html, '<div class="empty"><b>לא נמצא ביקור פעיל</b></div>');
    }
    var body = '<div class="scan-stage">';
    var inLocked = r.status!=='claimed';
    body += '<div class="scan-card '+(inLocked ? 'locked':'')+'">' +
      '<span style="font-size:15px; font-weight:700;">בהגעה למחלקה</span>' +
      qrSvg(r.status!=='claimed') +
      (r.status==='claimed'
        ? '<button class="btn btn-primary btn-block" data-action="check-in" data-id="'+r.id+'" '+(state.busy['checkin-'+r.id]?'disabled':'')+'>'+(state.busy['checkin-'+r.id]?'רושמים כניסה…':'אישור סריקת כניסה')+'</button>'
        : '<span class="small">'+ (r.checkInAt ? 'נכנסת ב-'+fmtDT(r.checkInAt) : 'ממתין') +'</span>') +
    '</div>';
    body += '<div class="scan-connector"><i></i><span></span><i></i></div>';
    var outLocked = r.status==='claimed';
    body += '<div class="scan-card '+(outLocked?'locked':'')+'">' +
      '<span style="font-size:15px; font-weight:700;">בסיום ההתנדבות</span>' +
      qrSvg(r.status==='claimed') +
      (r.status==='checked_in'
        ? '<button class="btn btn-accent btn-block" data-action="check-out" data-id="'+r.id+'" '+(state.busy['checkout-'+r.id]?'disabled':'')+'>'+(state.busy['checkout-'+r.id]?'רושמים יציאה…':'אישור סריקת יציאה')+'</button>'
        : (r.checkOutAt ? '<span class="small">יצאת ב-'+fmtDT(r.checkOutAt)+'</span>' : '<span class="small">ממתין לסיום הכניסה</span>')) +
    '</div>';
    body += '</div>';
    return wrapScreen(html, body);
  }

  // ================= SCREEN — feedback =================
  function screenFeedback(params){
    var r = state.requests.find(function(x){ return x.id===params.requestId; });
    var html = header('משוב לאחר ההתנדבות', {back:true});
    if(!r){
      return wrapScreen(html, '<div class="empty"><b>הביקור לא נמצא</b></div>');
    }
    var draft = state.feedbackDrafts[r.id]; if(draft===undefined) draft='';
    var choice = state.feedbackChoice[r.id] || 'once';
    var busy = !!state.busy['feedback-'+r.id];
    var body = '<div class="card-row"><span class="small">ביקרתי אצל</span><span class="chip chip-primary">'+esc(r.patientLabel||'')+'</span></div>';
    body += '<div class="field"><label for="fb-ta">מלל חופשי להקלדה</label><textarea id="fb-ta" rows="5" data-draft-for="'+r.id+'" placeholder="איך הלך הביקור? איך מרגיש/ה החולה?">'+esc(draft)+'</textarea></div>';
    body += '<div class="field"><label>האם תרצה/י להמשיך לבקר את החולה?</label><div class="card-row">' +
      '<button type="button" class="btn btn-outline '+(choice==='once'?'active':'')+'" data-action="set-recurring" data-id="'+r.id+'" data-value="once" style="flex:1;">חד פעמי</button>' +
      '<button type="button" class="btn btn-outline '+(choice==='recurring'?'active':'')+'" data-action="set-recurring" data-id="'+r.id+'" data-value="recurring" style="flex:1;">להמשך קבוע</button>' +
    '</div></div>';
    body += '<button class="btn btn-accent btn-block" data-action="submit-feedback" data-id="'+r.id+'" '+(busy?'disabled':'')+'>'+(busy?'שולחים…':'שליחת המשוב')+'</button>';
    return wrapScreen(html, body);
  }

  // ================= SCREEN — hours summary =================
  function screenHours(){
    var html = header('סיכום שעות חודשי', {back:true, sub:new Date().toLocaleDateString('he-IL',{month:'long', year:'numeric'})});
    var body = '';
    var totals = {};
    state.requests.forEach(function(r){
      if(r.checkInAt && r.checkOutAt && r.claimedByName){
        var h = hoursBetween(r.checkInAt, r.checkOutAt);
        totals[r.claimedByName] = (totals[r.claimedByName]||0) + h;
      }
    });
    var names = Object.keys(totals);
    if(names.length===0){
      body += '<div class="empty">⏱️<b>עדיין אין נתוני שעות</b><span>הנתונים יופיעו לאחר סימוני כניסה ויציאה מביקורים.</span></div>';
    } else {
      names.sort(function(a,b){ return totals[b]-totals[a]; });
      var max = Math.max.apply(null, names.map(function(n){ return totals[n]; }));
      var total = names.reduce(function(s,n){ return s+totals[n]; }, 0);
      var rows = names.map(function(n){
        var v = Math.round(totals[n]*10)/10;
        var pct = max>0 ? Math.max(6, Math.round((v/max)*100)) : 0;
        return '<div class="stat-row"><span class="stat-name" title="'+esc(n)+'">'+esc(n)+'</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;"></div></div>' +
          '<span class="stat-val">'+v+'</span></div>';
      }).join('');
      body += '<div class="total-card"><span>סה״כ שעות התנדבות החודש</span><span>'+(Math.round(total*10)/10)+'</span></div>';
      body += '<div class="card-flat">'+rows+'</div>';
      body += '<p class="hint">מחושב מסימוני כניסה/יציאה אמיתיים שנרשמו בביקורים.</p>';
    }
    return wrapScreen(html, body);
  }

  // ---------------- actions: auth ----------------
  function setBusy(key, val){ state.busy[key] = val; }

  function doLogin(email, pass){
    auth.signInWithEmailAndPassword(email, pass).catch(function(err){
      toast(authErrorMsg(err));
    });
  }
  function doRegister(name, email, pass){
    auth.createUserWithEmailAndPassword(email, pass).then(function(cred){
      if(name && cred.user){ cred.user.updateProfile({displayName:name}).catch(function(){}); }
    }).catch(function(err){
      toast(authErrorMsg(err));
    });
  }
  function doGoogleLogin(){
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function(err){
      if(err && err.code!=='auth/popup-closed-by-user') toast(authErrorMsg(err));
    });
  }
  function doLogout(){
    auth.signOut();
  }
  function doForgotPassword(){
    var emailInput = document.getElementById('li-email');
    var email = emailInput ? emailInput.value.trim() : '';
    if(!email){ toast('נא להקליד קודם את האימייל שלך בשדה למעלה'); return; }
    auth.sendPasswordResetEmail(email).then(function(){
      toast('נשלח אימייל לאיפוס סיסמה אל '+email);
    }).catch(function(err){ toast(authErrorMsg(err)); });
  }

  // ---------------- actions: db writes ----------------
  function claimRequest(id){
    if(state.busy['claim-'+id]) return;
    var myId = state.authUser.uid;
    setBusy('claim-'+id, true); render();
    var ref = db.collection('requests').doc(id);
    db.runTransaction(function(tx){
      return tx.get(ref).then(function(snap){
        var data = snap.data();
        if(!data || data.status !== 'open'){
          throw new Error('taken');
        }
        tx.update(ref, {
          status:'claimed',
          claimedByUid: myId,
          claimedByName: state.profile.name,
          claimedAt: new Date().toISOString()
        });
      });
    }).then(function(){
      toast('שובצת לבקשה!');
      setBusy('claim-'+id, false);
      push('scan', {requestId:id});
    }).catch(function(err){
      toast(err && err.message==='taken' ? 'הבקשה כבר לא פנויה' : 'לא הצלחנו לשבץ אותך, נסו שוב');
      setBusy('claim-'+id, false); render();
    });
  }

  function checkIn(id){
    if(state.busy['checkin-'+id]) return;
    setBusy('checkin-'+id, true); render();
    db.collection('requests').doc(id).update({status:'checked_in', checkInAt:new Date().toISOString()})
      .then(function(){ toast('נרשמה כניסה למחלקה'); setBusy('checkin-'+id, false); render(); })
      .catch(function(){ toast('משהו השתבש, נסו שוב'); setBusy('checkin-'+id, false); render(); });
  }
  function checkOut(id){
    if(state.busy['checkout-'+id]) return;
    setBusy('checkout-'+id, true); render();
    db.collection('requests').doc(id).update({status:'checked_out', checkOutAt:new Date().toISOString()})
      .then(function(){
        toast('נרשמה יציאה, תודה על הביקור!');
        setBusy('checkout-'+id, false);
        replaceTop('feedback', {requestId:id});
      })
      .catch(function(){ toast('משהו השתבש, נסו שוב'); setBusy('checkout-'+id, false); render(); });
  }
  function submitFeedback(id){
    if(state.busy['feedback-'+id]) return;
    var ta = document.getElementById('fb-ta');
    var text = ta ? ta.value : (state.feedbackDrafts[id]||'');
    var choice = state.feedbackChoice[id] || 'once';
    setBusy('feedback-'+id, true); render();
    db.collection('requests').doc(id).update({status:'done', feedbackText:text, recurring: choice==='recurring', feedbackAt:new Date().toISOString()})
      .then(function(){
        toast('המשוב נשלח, תודה!');
        delete state.feedbackDrafts[id];
        delete state.feedbackChoice[id];
        setBusy('feedback-'+id, false);
        goHome();
      })
      .catch(function(){ toast('משהו השתבש, נסו שוב'); setBusy('feedback-'+id, false); render(); });
  }
  function submitEditProfile(form){
    var uid = state.authUser.uid;
    var fd = new FormData(form);
    var name = (fd.get('name')||'').toString().trim();
    if(!name){ toast('נא למלא שם'); return; }
    var languages = fd.getAll('languages');
    var availability = (fd.get('availability')||'').toString().trim();
    var bio = (fd.get('bio')||'').toString().trim();
    var btn = form.querySelector('button[type="submit"]');
    if(btn) btn.disabled = true;
    db.collection('users').doc(uid).update({
      name: name, languages: languages, availability: availability, bio: bio
    }).then(function(){
      toast('הפרופיל עודכן');
      if(btn) btn.disabled = false;
    }).catch(function(){
      toast('העדכון נכשל, נסו שוב');
      if(btn) btn.disabled = false;
    });
  }
  function submitSendRequest(form){
    var fd = new FormData(form);
    var volunteerId = (fd.get('volunteerId')||'').toString() || null;
    var volunteerName = (fd.get('volunteerName')||'').toString() || null;
    var department = (fd.get('department')||'').toString();
    var patientLabel = (fd.get('patientLabel')||'').toString().trim();
    var age = parseInt(fd.get('age'),10);
    var gender = (fd.get('gender')||'').toString();
    var language = (fd.get('language')||'').toString();
    var note = (fd.get('note')||'').toString().trim();
    if(!department || !patientLabel || !gender || !language || isNaN(age)){
      toast('נא למלא את כל השדות הנדרשים');
      return;
    }
    var btn = form.querySelector('button[type="submit"]');
    if(btn) btn.disabled = true;
    var now = new Date().toISOString();
    db.collection('requests').add({
      department: department, patientLabel: patientLabel, age: age, gender: gender, language: language, note: note,
      status: volunteerId ? 'claimed' : 'open', createdAt: now, createdBy: state.profile.name,
      claimedByUid: volunteerId, claimedByName: volunteerName, claimedAt: volunteerId ? now : null,
      checkInAt: null, checkOutAt: null, feedbackText: null, recurring: null
    }).then(function(){
      toast(volunteerId ? 'הבקשה נשלחה ל'+volunteerName : 'הבקשה פורסמה למתנדבים');
      goHome();
    }).catch(function(){
      toast('הפרסום נכשל, נסו שוב');
      if(btn) btn.disabled = false;
    });
  }

  // ---------------- actions: user management ----------------
  function setUserRole(uid, role){
    db.collection('users').doc(uid).update({role: role}).then(function(){
      toast('התפקיד עודכן');
    }).catch(function(){ toast('העדכון נכשל, אין הרשאה מספקת'); });
  }
  function disableUser(uid){
    db.collection('users').doc(uid).update({disabled: true}).then(function(){
      toast('החשבון הושבת');
    }).catch(function(){ toast('הפעולה נכשלה, אין הרשאה מספקת'); });
  }
  function enableUser(uid){
    db.collection('users').doc(uid).update({disabled: false}).then(function(){
      toast('החשבון שוחזר');
    }).catch(function(){ toast('הפעולה נכשלה, אין הרשאה מספקת'); });
  }
  function createManager(name, email, pass){
    state.newManagerBusy = true; render();
    var secAuth = getSecondaryAuth();
    secAuth.createUserWithEmailAndPassword(email, pass).then(function(cred){
      var uid = cred.user.uid;
      return db.collection('users').doc(uid).set({
        uid: uid, email: email, name: name, role: 'manager', disabled: false,
        languages: [], availability: '', bio: '', createdAt: new Date().toISOString()
      }).then(function(){
        return secAuth.signOut();
      });
    }).then(function(){
      toast('חשבון המנהל/ת נוצר בהצלחה');
      state.newManagerBusy = false; render();
    }).catch(function(err){
      toast(authErrorMsg(err));
      state.newManagerBusy = false; render();
    });
  }

  // ---------------- events ----------------
  appEl.addEventListener('click', function(e){
    var btn = e.target.closest('[data-action]');
    if(!btn) return;
    var action = btn.dataset.action;
    if(action==='set-login-mode'){
      state.loginMode = btn.dataset.mode; render();
    } else if(action==='forgot-pass'){
      doForgotPassword();
    } else if(action==='google-login'){
      doGoogleLogin();
    } else if(action==='do-logout'){
      doLogout();
    } else if(action==='nav-back'){
      goBack();
    } else if(action==='go-my-profile'){
      push('profile', {uid: state.authUser.uid, mode:'self'});
    } else if(action==='open-profile'){
      push('profile', {uid: btn.dataset.id, mode:'view'});
    } else if(action==='send-to-volunteer'){
      push('sendRequest', {volunteerId: btn.dataset.id, volunteerName: btn.dataset.name});
    } else if(action==='new-request'){
      push('sendRequest', {});
    } else if(action==='go-hours'){
      push('hours', {});
    } else if(action==='go-manage-users'){
      push('manageUsers', {});
    } else if(action==='resume-visit'){
      push('scan', {requestId: btn.dataset.id});
    } else if(action==='claim-request'){
      claimRequest(btn.dataset.id);
    } else if(action==='check-in'){
      checkIn(btn.dataset.id);
    } else if(action==='check-out'){
      checkOut(btn.dataset.id);
    } else if(action==='submit-feedback'){
      submitFeedback(btn.dataset.id);
    } else if(action==='set-recurring'){
      state.feedbackChoice[btn.dataset.id] = btn.dataset.value; render();
    } else if(action==='set-role'){
      if(confirm('לשנות את התפקיד?')) setUserRole(btn.dataset.id, btn.dataset.role);
    } else if(action==='disable-user'){
      if(confirm('להשבית/למחוק את החשבון?')) disableUser(btn.dataset.id);
    } else if(action==='enable-user'){
      enableUser(btn.dataset.id);
    }
  });

  appEl.addEventListener('input', function(e){
    if(e.target && e.target.matches('[data-draft-for]')){
      state.feedbackDrafts[e.target.dataset.draftFor] = e.target.value;
    }
  });

  appEl.addEventListener('submit', function(e){
    var form = e.target.closest('[data-form]');
    if(!form) return;
    e.preventDefault();
    var kind = form.dataset.form;
    if(kind==='login'){
      var fd = new FormData(form);
      var email = (fd.get('email')||'').toString().trim();
      var pass = (fd.get('pass')||'').toString();
      if(!email || !pass){ toast('נא למלא אימייל וסיסמה'); return; }
      if(state.loginMode==='register'){
        var name = (fd.get('name')||'').toString().trim();
        if(!name){ toast('נא למלא שם מלא'); return; }
        doRegister(name, email, pass);
      } else {
        doLogin(email, pass);
      }
    } else if(kind==='edit-profile'){
      submitEditProfile(form);
    } else if(kind==='send-request'){
      submitSendRequest(form);
    } else if(kind==='new-manager'){
      var fd2 = new FormData(form);
      var mname = (fd2.get('name')||'').toString().trim();
      var memail = (fd2.get('email')||'').toString().trim();
      var mpass = (fd2.get('pass')||'').toString();
      if(!mname || !memail || !mpass){ toast('נא למלא את כל השדות'); return; }
      createManager(mname, memail, mpass);
    }
  });

  // ---------------- boot: auth + live data ----------------
  function screenNeedsRequestsLive(){
    var top = state.stack[state.stack.length-1];
    if(!top) return false;
    return ['openRequests','volunteerList','manageUsers','profile','hours','scan','feedback'].indexOf(top.screen) > -1;
  }
  function screenNeedsVolunteersLive(){
    var top = state.stack[state.stack.length-1];
    if(!top) return false;
    return ['volunteerList','manageUsers','profile'].indexOf(top.screen) > -1;
  }

  function attachLiveData(){
    if(unsubRequests) unsubRequests();
    if(unsubVolunteers) unsubVolunteers();
    unsubRequests = db.collection('requests').orderBy('createdAt','desc').onSnapshot(function(snap){
      state.requests = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      state.requestsLoaded = true;
      if(screenNeedsRequestsLive()) render();
    }, function(){ state.requestsLoaded = true; });
    unsubVolunteers = db.collection('users').orderBy('createdAt','desc').onSnapshot(function(snap){
      state.volunteers = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      state.volunteersLoaded = true;
      if(screenNeedsVolunteersLive()) render();
    }, function(){ state.volunteersLoaded = true; });
  }
  function detachLiveData(){
    if(unsubRequests){ unsubRequests(); unsubRequests=null; }
    if(unsubVolunteers){ unsubVolunteers(); unsubVolunteers=null; }
    if(unsubProfile){ unsubProfile(); unsubProfile=null; }
    state.requests=[]; state.requestsLoaded=false;
    state.volunteers=[]; state.volunteersLoaded=false;
    state.profile=null; state.profileLoaded=false;
  }

  function ensureUserDoc(user){
    var ref = db.collection('users').doc(user.uid);
    return ref.get().then(function(snap){
      if(snap.exists) return;
      var role = (user.email && user.email.toLowerCase()===ADMIN_EMAIL.toLowerCase()) ? 'admin' : 'volunteer';
      return ref.set({
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'משתמש/ת'),
        role: role,
        disabled: false,
        languages: [], availability: '', bio: '',
        createdAt: new Date().toISOString()
      });
    });
  }

  auth.onAuthStateChanged(function(user){
    detachLiveData();
    state.ready = true;
    if(!user){
      state.authUser = null;
      render();
      return;
    }
    state.authUser = user;
    render();
    ensureUserDoc(user).then(function(){
      unsubProfile = db.collection('users').doc(user.uid).onSnapshot(function(snap){
        if(!snap.exists) return;
        var data = snap.data();
        if(data.disabled){
          toast('החשבון הושבת על ידי מנהל/ת המערכת');
          auth.signOut();
          return;
        }
        var hadProfile = !!state.profile;
        state.profile = data;
        state.profileLoaded = true;
        if(!hadProfile){
          state.stack = [{screen: homeScreen(), params:{}}];
          attachLiveData();
        }
        render();
      }, function(){
        toast('לא הצלחנו לטעון את הפרופיל שלך');
      });
    }).catch(function(){
      toast('שגיאה ביצירת פרופיל המשתמש');
    });
  });

  render();
})();
