// Self-service account deletion page (accountdelete/index.html).
// Anyone except the owner can delete their own account here: personal data
// in users/{uid} is replaced by the same tombstone an admin's "permanent
// delete" leaves, and then the Firebase Authentication account itself is
// deleted. The owner must first transfer ownership from the app.
(function(){
  'use strict';

  var ROLE_LABELS = {owner:'בעלים', admin:'אדמין ראשי', manager:'מנהל/ת מחלקה', volunteer:'מתנדב/ת'};
  var ACTIVE_STATUSES = ['claimed','checked_in','checked_out'];

  firebase.initializeApp(firebaseConfig);
  var auth = firebase.auth();
  var db = firebase.firestore();

  var stateEl = document.getElementById('ad-state');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  var state = {
    phase: 'loading',   // loading | signedOut | ready | owner | activeVisit | done
    user: null,
    profile: null,      // users/{uid} data, null if none (or already deleted)
    busy: false
  };

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 3600);
  }
  function authErrorMsg(err){
    var code = err && err.code || '';
    var map = {
      'auth/invalid-email': 'כתובת אימייל לא תקינה',
      'auth/wrong-password': 'סיסמה שגויה',
      'auth/invalid-credential': 'אימייל או סיסמה שגויים',
      'auth/invalid-login-credentials': 'אימייל או סיסמה שגויים',
      'auth/user-not-found': 'לא נמצא חשבון עם האימייל הזה',
      'auth/user-mismatch': 'יש להתחבר מחדש עם אותו חשבון שמוחקים',
      'auth/too-many-requests': 'יותר מדי ניסיונות — נסו שוב בעוד כמה דקות',
      'auth/popup-closed-by-user': 'החלון נסגר לפני השלמת ההתחברות'
    };
    return map[code] || 'משהו השתבש, נסו שוב';
  }
  function hasPasswordProvider(user){
    return (user.providerData || []).some(function(p){ return p.providerId==='password'; });
  }
  function signOutBtn(){
    return '<button type="button" class="btn btn-outline btn-block" data-action="sign-out">התנתקות</button>';
  }
  function whoAmI(){
    var p = state.profile;
    return '<div class="card-row" style="gap:8px;"><span class="small">מחובר/ת בתור</span><b style="font-size:14px;">'+esc(state.user.email||'')+'</b>' +
      (p ? '<span class="role-badge role-'+esc(p.role)+'">'+esc(ROLE_LABELS[p.role]||p.role)+'</span>' : '') + '</div>';
  }

  function render(){
    var html = '';
    if(state.phase==='loading'){
      html = '<div class="empty"><b>טוען…</b></div>';
    } else if(state.phase==='signedOut'){
      html = '<div class="card-flat">' +
        '<span class="card-title" style="font-size:15px;">התחברו לחשבון שברצונכם למחוק</span>' +
        '<form data-form="login" style="display:flex; flex-direction:column; gap:12px;">' +
          '<div class="field"><label for="ad-email">אימייל</label><input id="ad-email" name="email" type="email" required autocomplete="email"></div>' +
          '<div class="field"><label for="ad-pass">סיסמה</label><input id="ad-pass" name="pass" type="password" required autocomplete="current-password"></div>' +
          '<button type="submit" class="btn btn-primary btn-block">התחברות</button>' +
        '</form>' +
        '<div class="or-sep">או</div>' +
        '<button type="button" class="btn btn-google btn-block" data-action="google-login">התחברות עם Google</button>' +
      '</div>';
    } else if(state.phase==='owner'){
      html = '<div class="card-flat">' + whoAmI() +
        '<div class="banner">אי אפשר למחוק את חשבון הבעלים. כדי למחוק אותו, קודם צריך להעביר את הבעלות לאדמין ראשי אחר: באפליקציה, במסך "ניהול משתמשים", בכפתור "העברת בעלות". אחרי ההעברה אפשר לחזור לכאן ולמחוק את החשבון.</div>' +
        '<a class="btn btn-primary btn-block" style="text-align:center; text-decoration:none;" href="../">מעבר לאפליקציה</a>' +
        signOutBtn() +
      '</div>';
    } else if(state.phase==='activeVisit'){
      html = '<div class="card-flat">' + whoAmI() +
        '<div class="banner">יש לך ביקור פעיל שעוד לא הסתיים. סיימו אותו באפליקציה (כולל שליחת המשוב), או בקשו ממנהל/ת המחלקה לבטל את השיבוץ, ואז חזרו לכאן כדי למחוק את החשבון.</div>' +
        '<a class="btn btn-primary btn-block" style="text-align:center; text-decoration:none;" href="../">מעבר לאפליקציה</a>' +
        signOutBtn() +
      '</div>';
    } else if(state.phase==='ready'){
      var pw = hasPasswordProvider(state.user);
      html = '<div class="card-flat">' + whoAmI() +
        (state.profile ? '' : '<p class="hint" style="margin:0;">לא נמצאו פרטי פרופיל פעילים לחשבון הזה. המחיקה תסיר את חשבון ההתחברות.</p>') +
        '<form data-form="delete" style="display:flex; flex-direction:column; gap:12px;">' +
          (pw ? '<div class="field"><label for="ad-confirm-pass">לאישור, הקלידו שוב את הסיסמה</label><input id="ad-confirm-pass" name="pass" type="password" required autocomplete="current-password"></div>'
              : '<p class="hint" style="margin:0;">לאישור תתבקשו להתחבר שוב עם Google.</p>') +
          '<label style="display:flex; gap:8px; font-size:14px; align-items:flex-start;"><input type="checkbox" name="ack" required style="margin-top:4px; flex-shrink:0;"><span>אני מבין/ה שהמחיקה סופית, ושלא ניתן יהיה לשחזר את החשבון</span></label>' +
          '<button type="submit" class="btn btn-danger btn-block" '+(state.busy?'disabled':'')+'>'+(state.busy?'מוחקים…':'מחיקת החשבון לצמיתות')+'</button>' +
        '</form>' +
        signOutBtn() +
      '</div>';
    } else if(state.phase==='done'){
      html = '<div class="card-flat" style="align-items:center; text-align:center;">' +
        '<span class="card-title" style="font-size:17px;">החשבון נמחק</span>' +
        '<p class="small" style="margin:0;">החשבון והפרטים האישיים נמחקו לצמיתות. תודה על הזמן שתרמת!</p>' +
      '</div>';
    }
    stateEl.innerHTML = html;
  }

  // Figures out what the signed-in person may do on this page.
  function loadAccount(user){
    state.phase = 'loading'; render();
    db.collection('users').doc(user.uid).get().then(function(snap){
      var data = snap.exists ? snap.data() : null;
      state.profile = (data && !data.deleted) ? data : null;
      if(state.profile && state.profile.role==='owner'){
        state.phase = 'owner'; render();
        return;
      }
      if(!state.profile || state.profile.disabled){
        state.phase = 'ready'; render();
        return;
      }
      return db.collection('requests').where('claimedByUid','==',user.uid).get().then(function(qs){
        var active = qs.docs.some(function(d){ return ACTIVE_STATUSES.indexOf(d.data().status) > -1; });
        state.phase = active ? 'activeVisit' : 'ready';
        render();
      });
    }).catch(function(){
      state.profile = null;
      state.phase = 'ready'; render();
    });
  }

  function reauthenticate(pass){
    var user = auth.currentUser;
    if(hasPasswordProvider(user)){
      var cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
      return user.reauthenticateWithCredential(cred);
    }
    return user.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
  }

  function deleteAccount(pass){
    if(state.busy) return;
    var user = auth.currentUser;
    if(!user) return;
    setBusy(true);
    reauthenticate(pass).then(function(){
      if(!state.profile) return;
      // Wipe personal data first, while still signed in.
      return db.collection('users').doc(user.uid).set({
        uid: user.uid, role: state.profile.role, disabled: true, deleted: true, deletedAt: new Date().toISOString()
      });
    }).then(function(){
      state.phase = 'done';
      return user.delete();
    }).then(function(){
      setBusy(false); render();
    }).catch(function(err){
      setBusy(false);
      if(state.phase==='done'){
        // Personal data is already gone; only removing the login failed.
        toast('הפרטים נמחקו, אך מחיקת חשבון ההתחברות נכשלה. נסו שוב או פנו אלינו במייל.');
        state.phase = 'ready'; state.profile = null;
        render();
        return;
      }
      // Keep the form as it is (password, confirmation) so they can retry.
      toast(err && err.code ? authErrorMsg(err) : 'המחיקה נכשלה, נסו שוב');
    });
  }
  // Updates only the submit button, so the form keeps what was typed.
  function setBusy(busy){
    state.busy = busy;
    var btn = stateEl.querySelector('form[data-form="delete"] button[type=submit]');
    if(btn){
      btn.disabled = busy;
      btn.textContent = busy ? 'מוחקים…' : 'מחיקת החשבון לצמיתות';
    }
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-action]');
    if(!btn) return;
    if(btn.dataset.action==='google-login'){
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function(err){
        if(err && err.code!=='auth/popup-closed-by-user') toast(authErrorMsg(err));
      });
    } else if(btn.dataset.action==='sign-out'){
      auth.signOut();
    }
  });

  document.addEventListener('submit', function(e){
    var form = e.target.closest('[data-form]');
    if(!form) return;
    e.preventDefault();
    var fd = new FormData(form);
    if(form.dataset.form==='login'){
      var email = (fd.get('email')||'').toString().trim();
      var pass = (fd.get('pass')||'').toString();
      auth.signInWithEmailAndPassword(email, pass).catch(function(err){ toast(authErrorMsg(err)); });
    } else if(form.dataset.form==='delete'){
      if(!fd.get('ack')) return;
      deleteAccount((fd.get('pass')||'').toString());
    }
  });

  auth.onAuthStateChanged(function(user){
    if(state.phase==='done'){ render(); return; }
    state.user = user;
    state.profile = null;
    if(!user){
      state.phase = 'signedOut'; render();
      return;
    }
    loadAccount(user);
  });
})();
