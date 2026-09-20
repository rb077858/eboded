# אי בודד — אתר סטטי + Firebase

אתר סטטי (HTML/CSS/JS ללא build step) לניהול מתנדבים בבית חולים, עם התחברות
אמיתית (אימייל+סיסמה או Google) דרך Firebase Authentication, ומסד נתונים
אמיתי ב-Firestore עם כללי אבטחה בצד השרת.

## מבנה התפקידים

| תפקיד | עברית | הרשאות |
|---|---|---|
| `admin` | אדמין ראשי | הכל: יצירת מנהלי מחלקה, שינוי תפקידים, השבתה/מחיקה של כל משתמש |
| `manager` | מנהל/ת מחלקה | פרסום בקשות, צפייה במתנדבים, השבתה/מחיקה של מתנדבים בלבד |
| `volunteer` | מתנדב/ת | נרשמים בעצמם, מנהלים פרופיל אישי, נענים לבקשות |

חשבון האדמין הראשי הנוכחי: **rb077858@gmail.com** — מוגדר בקובץ
`js/firebase-config.js` (`ADMIN_EMAIL`) וגם בקובץ `firestore.rules`
(`bootstrapRole()`). ברגע שהוא נכנס לראשונה (עם סיסמה או Google), הוא הופך
אוטומטית לאדמין. מאותו רגע, ניתן להעביר את הניהול הראשי לכל משתמש אחר דרך
מסך "ניהול משתמשים" באפליקציה (כפתור הגלגל שיניים בראש רשימת המתנדבים).

מנהלי מחלקה **לא** יכולים להירשם בעצמם — רק האדמין הראשי יוצר אותם, דרך
טופס "יצירת חשבון מנהל/ת מחלקה" באותו מסך ניהול. מתנדבים לעומת זאת נרשמים
בעצמם ישירות ממסך ההתחברות ("הרשמת מתנדב/ת חדש/ה").

## שלב 1 — יצירת פרויקט Firebase

1. גשו ל-[console.firebase.google.com](https://console.firebase.google.com)
   ולחצו "Add project" (תוכנית Spark החינמית מספיקה).
2. בתוך הפרויקט, לחצו על סמל ה-`</>` כדי לרשום אפליקציית Web חדשה. תנו לה
   שם (למשל "אי בודד") ולחצו "Register app".
3. Firebase יציג אובייקט קונפיגורציה כזה:
   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
   העתיקו את הערכים האלה לתוך `js/firebase-config.js` באתר (מחליפים את
   כל ה-`"YOUR_..."`).

## שלב 2 — הפעלת שיטות התחברות

ב-Firebase Console: **Build → Authentication → Sign-in method**, והפעילו:
- **Email/Password** — Enable
- **Google** — Enable (בחרו אימייל תמיכה לפרויקט)

## שלב 3 — יצירת מסד נתונים Firestore

**Build → Firestore Database → Create database**. בחרו **Production mode**
(לא test mode — האבטחה שלנו יושבת בקובץ `firestore.rules`, לא בברירת
המחדל). בחרו את המיקום הקרוב אליכם (למשל `europe-west1`).

## שלב 4 — פריסת כללי האבטחה (firestore.rules)

יש שתי דרכים, בחרו את הנוחה לכם:

**א. דרך הקונסול (הכי פשוט):**
בפרויקט ב-Firebase Console, גשו ל-**Firestore Database → Rules**, מחקו
את מה שיש שם, הדביקו את כל התוכן של הקובץ `firestore.rules` מהאתר הזה,
ולחצו **Publish**.

**ב. דרך שורת הפקודה (Firebase CLI):**
```bash
npm install -g firebase-tools
firebase login
# בתוך תיקיית האתר:
firebase use --add          # ובחרו את הפרויקט שיצרתם
firebase deploy --only firestore:rules
```

⚠️ **חשוב**: בלי לפרוס את `firestore.rules`, מסד הנתונים ינעל את כל
הגישה (ברירת המחדל של Production mode) או יהיה פתוח לגמרי (אם בטעות
בחרתם Test mode) — בשני המקרים האפליקציה לא תעבוד כמו שצריך.

## שלב 5 — העלאה ל-GitHub

```bash
git init
git add .
git commit -m "אי בודד — אתר מתנדבים עם Firebase"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

(אל תשכחו למלא קודם את `js/firebase-config.js` עם הערכים האמיתיים לפני
ה-push, אחרת האתר לא יתחבר ל-Firebase שלכם.)

## שלב 6 — פרסום (Hosting)

יש כמה אפשרויות — כל אחת עובדת, כי כל הקריאות ל-Firebase (התחברות,
מסד הנתונים) הן קריאות מהדפדפן ישירות לשרתי Firebase, לא משנה איפה
מתארח קובץ ה-HTML עצמו:

**אפשרות א׳ — GitHub Pages (הכי פשוט אם כבר יש לכם GitHub):**
ב-repo, לכו ל-**Settings → Pages**, ובחרו את הענף `main` והתיקייה `/`
(root). האתר יעלה לכתובת `https://USERNAME.github.io/REPO/`.

**אפשרות ב׳ — Firebase Hosting:**
```bash
firebase deploy --only hosting
```
(דורש שהרצתם קודם `firebase use --add` כמו בשלב 4).

אחרי פריסה בכל אחת מהשיטות, חשוב לחזור ל-**Authentication → Settings →
Authorized domains** ב-Firebase Console ולוודא שהדומיין של האתר (למשל
`username.github.io`) מופיע ברשימה — Firebase חוסם התחברות מדומיינים
לא מוכרים.

## מבנה הקבצים

```
index.html              דף האתר היחיד (SPA)
css/styles.css           כל העיצוב
js/firebase-config.js    קונפיגורציית Firebase + ADMIN_EMAIL — למלא בשלב 1
js/app.js                כל לוגיקת האפליקציה
firestore.rules          כללי אבטחה של מסד הנתונים — לפרוס בשלב 4
firebase.json            קונפיגורציית Firebase Hosting (אופציונלי)
.firebaserc              מזהה הפרויקט (אופציונלי, לשימוש עם Firebase CLI)
```

## מגבלה ידועה: "מחיקת" מתנדבים

מחיקה אמיתית של חשבון התחברות (Firebase Authentication) דורשת הרשאות
שרת (Admin SDK) שלא זמינות מאתר סטטי טהור ללא שרת משלכם. לכן "מחיקת
מתנדב/ת" באפליקציה בפועל **משביתה** (`disabled`) את החשבון: המשתמש/ת
לא יוכלו יותר להתחבר או להופיע ברשימות הפעילות, אבל חשבון ההתחברות
עצמו (האימייל, הסיסמה) עדיין קיים ב-Firebase. אם תרצו מחיקה אמיתית
ומוחלטת, יש להוסיף בהמשך Cloud Function קטנה עם ה-Admin SDK — זה כבר
דורש תוכנית Firebase בתשלום (Blaze) ותחזוקת שרת, ולכן לא נכלל כאן.

## מגבלה נוספת: איפוס סיסמה

כפתור "שכחתי סיסמה" שולח מייל איפוס אמיתי דרך Firebase
(`sendPasswordResetEmail`) — זה עובד ישר מהקופסה, בלי הגדרה נוספת.
