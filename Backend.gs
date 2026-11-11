/**
 * UPSI Global Psychology Conference 2027 — independent web app MVP.
 * Deploy as "Execute as me" AND access "Only your Google Workspace domain".
 * Only use for same-domain reviewer accounts; fail closed if identity is unavailable.
 * The spreadsheet remains private to authorised administrators.
 * No triggers are installed here. Existing Form 1/2/3 automation remains in its original project.
 */
const PORTAL27 = Object.freeze({
  master: 'MASTER_POSTERS', config: 'CONFIG', assignments: 'ASSIGNMENTS',
  evaluations: 'EVALUATION_RESPONSES', screeningLog: 'SCREENING_LOG',
  weights: [15,20,25,20,10,10],
  rubric: ['Relevance','Originality','Methodology','Poster Clarity','Video Presentation','Impact'],
  forms: {
    abstract: 'https://forms.gle/AFHDU9Fh8CSDdYQ77',
    poster: 'https://forms.gle/eaWVtStGpQSh4oLZA',
    evaluation: 'https://forms.gle/nnKCGRPbifSkgVLA8'
  },
  evaluationHeaders: ['Received At','Form Response ID','Poster ID','Reviewer Email','Validation Status',
    'Detail','Relevance','Originality','Methodology','Poster Clarity','Video Presentation',
    'Impact','Weighted Score','Evaluator Comments','Assignment Row','Processed At'],
  assignmentHeaders: ['When','Poster ID','Theme','Reviewer Email','Review Key','Evaluation Form Link','Status',
    'Reviewer Name','Assigned By','Form 2 Response ID','Notification Status','Notification Detail']
});

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('UPSI 2027 | Conference Management')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}
function portal27Email_() {
  // Fail closed: blank identities are not silently promoted to the owner.
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Google account identity is unavailable. This account identity is unavailable. Use a domain-only Apps Script deployment with UPSI Workspace sign-in; do not use anonymous access.');
  }
  return email;
}
function portal27Props_(){return PropertiesService.getScriptProperties();}
function portal27SS_(){
  const id=portal27Props_().getProperty('SHEET_ID');
  if(!id)throw Error('SHEET_ID is not configured in this new web-app project.');
  return SpreadsheetApp.openById(id);
}
function portal27Admins_(){
  return String(portal27Props_().getProperty('PORTAL_ADMIN_EMAILS')||'')
    .toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
}
function portal27Admin_(email){return portal27Admins_().includes(email);}
function portal27Sheet_(ss,name){const s=ss.getSheetByName(name);if(!s)throw Error('Missing required sheet: '+name);return s;}
function portal27Map_(s){
  const heads=s.getRange(1,1,1,Math.max(s.getLastColumn(),1)).getDisplayValues()[0];
  const m={};heads.forEach((v,i)=>{const k=String(v||'').trim();if(k){if(m[k]!==undefined)throw Error('Duplicate column heading: '+k+' in '+s.getName());m[k]=i;}});return m;
}
function portal27Rows_(s){
  const m=portal27Map_(s), count=s.getLastRow();
  if(count<2)return [];
  const vals=s.getRange(2,1,count-1,Math.max(s.getLastColumn(),1)).getValues();
  return vals.map((r,i)=>({row:i+2, data:r, map:m}));
}
function portal27Str_(row,key){const i=row.map[key];return i===undefined?'':String(row.data[i] == null?'':row.data[i]).trim();}
function portal27Txt_(row,key){return portal27Str_(row,key);}
function portal27Col_(s,key){const m=portal27Map_(s);if(m[key]===undefined)throw Error('Missing column '+key+' in '+s.getName());return m[key]+1;}
function portal27Record_(row){
  return {
    id:portal27Txt_(row,'Poster ID'), author:portal27Txt_(row,'Full Name'),
    email:portal27Txt_(row,'Email Address')||portal27Txt_(row,'Email'),
    title:portal27Txt_(row,'Title'), category:portal27Txt_(row,'Category'),
    theme:portal27Txt_(row,'Theme Code'), themeName:portal27Txt_(row,'Theme Name'),
    abstract:portal27Txt_(row,'Abstract'), wordCount:portal27Txt_(row,'Word Count'),
    screening:portal27Txt_(row,'Screening'), screeningNote:portal27Txt_(row,'Screening Note'),
    payment:portal27Txt_(row,'Payment Verified'), submission:portal27Txt_(row,'Poster Submission Status'),
    pdf:portal27Txt_(row,'Poster PDF Link')||portal27Txt_(row,'Poster URL'),
    video:portal27Txt_(row,'Video Link')||portal27Txt_(row,'Video URL'),
    receipt:portal27Txt_(row,'Payment Receipt Link')||portal27Txt_(row,'Receipt URL'),
    reviewer:portal27Txt_(row,'Assigned Reviewer'), reviewState:portal27Txt_(row,'Review State'),
    evaluationStatus:portal27Txt_(row,'Evaluation Status'),
    evaluationScore:portal27Txt_(row,'Evaluation Score'),
    form2ResponseId:portal27Txt_(row,'Form 2 Response ID')
  };
}
function portal27SafeUrl_(v){let s=String(v||'').trim();return /^https:\/\//i.test(s)?s:'';}
function portal27ReviewerSet_(assignments,email){
  return new Set(assignments.filter(a=>portal27Str_(a,'Reviewer Email').toLowerCase()===email)
    .map(a=>portal27Str_(a,'Poster ID').toUpperCase()).filter(Boolean));
}
function portal27Role_(){
  const email=portal27Email_();
  if(portal27Admin_(email))return {email,role:'chief'};
  const ss=portal27SS_(),a=portal27Rows_(portal27Sheet_(ss,PORTAL27.assignments));
  const themeRows=portal27Rows_(portal27Sheet_(ss,PORTAL27.config));
  const configured=themeRows.some(r=>portal27Str_(r,'Co-chair Email').toLowerCase()===email);
  const assigned=a.some(r=>portal27Str_(r,'Reviewer Email').toLowerCase()===email);
  if(configured||assigned)return {email,role:'reviewer'};
  return {email,role:'none'};
}
function portal27RequireChief_(){const user=portal27Role_();if(user.role!=='chief')throw Error('Chief Reviewer access required.');return user;}
function portal27EvaluationList_(rows){
  return rows.filter(r=>portal27Str_(r,'Validation Status').toUpperCase()==='VALID')
    .map(r=>({posterId:portal27Str_(r,'Poster ID'),reviewer:portal27Str_(r,'Reviewer Email'),score:Number(portal27Str_(r,'Weighted Score')),
      comments:portal27Str_(r,'Evaluator Comments'),received:String(portal27Str_(r,'Received At'))}));
}
function portal27Bootstrap(){
  const user=portal27Role_();
  const base={user,forms:PORTAL27.forms,stats:null,posters:[],evaluations:[],themes:[]};
  if(user.role==='none')return base;
  const ss=portal27SS_(),m=portal27Rows_(portal27Sheet_(ss,PORTAL27.master));
  const a=portal27Rows_(portal27Sheet_(ss,PORTAL27.assignments));
  const ev=portal27Rows_(portal27Sheet_(ss,PORTAL27.evaluations));
  if(user.role==='chief'){
    base.posters=m.map(portal27Record_);
    base.evaluations=portal27EvaluationList_(ev);
    base.themes=portal27Rows_(portal27Sheet_(ss,PORTAL27.config)).map(r=>({code:portal27Str_(r,'Theme Code'),name:portal27Str_(r,'Theme Name'),email:portal27Str_(r,'Co-chair Email'),reviewerName:portal27Str_(r,'Co-chair Name')}));
  }else{
    const assignedIds=portal27ReviewerSet_(a,user.email);
    const matched=m.filter(r=>assignedIds.has(portal27Str_(r,'Poster ID').toUpperCase()));
    // Deliberately omit author email, abstract, receipt and sensitive administrative notes from reviewer response.
    base.posters=matched.map(r=>{
      const p=portal27Record_(r);return {id:p.id,title:p.title,category:p.category,theme:p.theme,themeName:p.themeName,
        pdf:p.pdf,video:p.video,screening:p.screening,reviewState:p.reviewState,
        evaluationStatus:p.evaluationStatus,evaluationScore:p.evaluationScore};
    });
    base.evaluations=portal27EvaluationList_(ev).filter(e=>e.reviewer.toLowerCase()===user.email&&assignedIds.has(e.posterId.toUpperCase()));
  }
  const p=base.posters;
  base.stats={total:p.length,accepted:p.filter(x=>x.screening.toUpperCase()==='ACCEPTED').length,
    verified:p.filter(x=>x.payment&&x.payment.toUpperCase()==='VERIFIED').length,
    assigned:p.filter(x=>x.reviewer||x.reviewState==='ASSIGNED').length,
    evaluated:base.evaluations.length};
  return base;
}
/** Chief-only individual assignment; notifications are intentionally disabled. */
function portal27Assign(posterId){
  const admin=portal27RequireChief_(),id=String(posterId||'').trim().toUpperCase();
  if(!/^UGPS27-T0[1-8]-\d{3,}$/.test(id))throw Error('Invalid Poster ID.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=portal27SS_(),master=portal27Sheet_(ss,PORTAL27.master),ass=portal27Sheet_(ss,PORTAL27.assignments);
    const matches=portal27Rows_(master).filter(r=>portal27Str_(r,'Poster ID').toUpperCase()===id);
    if(matches.length!==1)throw Error('Poster ID not uniquely found.');
    const r=matches[0],p=portal27Record_(r);
    if(p.screening.toUpperCase()!=='ACCEPTED'||p.payment.toUpperCase()!=='VERIFIED'||p.submission.toUpperCase()!=='RECEIVED - PAYMENT REVIEW'){
      throw Error('Only accepted, payment-verified, complete Form 2 submissions can be assigned.');
    }
    if(!p.form2ResponseId||!p.pdf||!p.video||!p.receipt)throw Error('Required Form 2 evidence is missing.');
    if(p.reviewer||p.reviewState.toUpperCase()==='ASSIGNED')throw Error('This poster is already assigned in MASTER_POSTERS.');
    if(portal27Rows_(ass).some(x=>portal27Str_(x,'Poster ID').toUpperCase()===id))throw Error('Existing assignment record.');
    const themes=portal27Rows_(portal27Sheet_(ss,PORTAL27.config)).filter(x=>portal27Str_(x,'Theme Code').toUpperCase()===p.theme.toUpperCase());
    if(themes.length!==1)throw Error('Theme must match exactly one CONFIG row.');
    const t=themes[0],reviewer=portal27Str_(t,'Co-chair Email').toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewer))throw Error('Missing/invalid co-chair email in CONFIG.');
    const map=portal27Map_(ass);
    PORTAL27.assignmentHeaders.forEach(h=>{if(map[h]===undefined)throw Error('ASSIGNMENTS missing heading: '+h);});
    const entry={'When':new Date(),'Poster ID':id,'Theme':p.theme,'Reviewer Email':reviewer,'Review Key':'',
      'Evaluation Form Link':PORTAL27.forms.evaluation,'Status':'PENDING','Reviewer Name':portal27Str_(t,'Co-chair Name'),
      'Assigned By':admin.email,'Form 2 Response ID':p.form2ResponseId,'Notification Status':'NOT SENT',
      'Notification Detail':'Created from portal; email disabled'};
    const values=Array(ass.getLastColumn()).fill('');Object.entries(entry).forEach(([k,v])=>values[map[k]]=v);
    ass.appendRow(values);
    master.getRange(r.row,portal27Col_(master,'Assigned Reviewer')).setValue(reviewer);
    master.getRange(r.row,portal27Col_(master,'Review State')).setValue('ASSIGNED');
    master.getRange(r.row,portal27Col_(master,'Assignment Date')).setValue(new Date());
    SpreadsheetApp.flush();
    return {ok:true,message:'Assigned '+id+' to '+reviewer+'. No email sent.'};
  }finally{lock.releaseLock();}
}
/** Reviewer-only, single authoritative evaluation per assigned reviewer/poster. */
function portal27SubmitEvaluation(payload){
  const user=portal27Role_();if(user.role!=='reviewer')throw Error('Only assigned theme reviewers may submit ratings.');
  if(!payload||typeof payload!=='object')throw Error('Evaluation payload is missing.');
  const id=String(payload.posterId||'').trim().toUpperCase(),ratings=payload.ratings;
  if(!/^UGPS27-T0[1-8]-\d{3,}$/.test(id))throw Error('Invalid Poster ID.');
  if(!Array.isArray(ratings)||ratings.length!==6||ratings.some(v=>!Number.isInteger(v)||v<1||v>5)){
    throw Error('All six ratings must be integers from 1 to 5.');
  }
  const comments=String(payload.comments||'').trim();if(comments.length>3000)throw Error('Comment exceeds 3,000 characters.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=portal27SS_(),master=portal27Sheet_(ss,PORTAL27.master),ass=portal27Sheet_(ss,PORTAL27.assignments),ev=portal27Sheet_(ss,PORTAL27.evaluations);
    const ar=portal27Rows_(ass).filter(r=>portal27Str_(r,'Poster ID').toUpperCase()===id&&portal27Str_(r,'Reviewer Email').toLowerCase()===user.email);
    if(ar.length!==1)throw Error('Exactly one assignment to your verified account is required.');
    const a=ar[0];if(portal27Str_(a,'Status').toUpperCase()!=='PENDING')throw Error('This assignment is no longer pending.');
    const mr=portal27Rows_(master).filter(r=>portal27Str_(r,'Poster ID').toUpperCase()===id);
    if(mr.length!==1)throw Error('Poster record not uniquely found.');
    const m=mr[0],p=portal27Record_(m);
    if(p.reviewer.toLowerCase()!==user.email||p.screening.toUpperCase()!=='ACCEPTED'||p.payment.toUpperCase()!=='VERIFIED'){
      throw Error('Assigned reviewer or poster eligibility has changed.');
    }
    const existing=portal27Rows_(ev).some(r=>portal27Str_(r,'Poster ID').toUpperCase()===id&&
      portal27Str_(r,'Reviewer Email').toLowerCase()===user.email&&portal27Str_(r,'Validation Status').toUpperCase()==='VALID');
    if(existing)throw Error('This poster already has a valid evaluation from your account.');
    const map=portal27Map_(ev);PORTAL27.evaluationHeaders.forEach(h=>{if(map[h]===undefined)throw Error('EVALUATION_RESPONSES missing column: '+h);});
    const score=ratings.reduce((s,v,i)=>s+v*PORTAL27.weights[i]/5,0);
    const now=new Date();const entry={'Received At':now,'Form Response ID':'WEB-'+Utilities.getUuid(),
      'Poster ID':id,'Reviewer Email':user.email,'Validation Status':'VALID','Detail':'Submitted by authenticated portal user',
      'Weighted Score':Math.round(score*100)/100,'Evaluator Comments':comments,'Assignment Row':a.row,'Processed At':now};
    PORTAL27.rubric.forEach((k,i)=>entry[k]=ratings[i]);
    const values=Array(ev.getLastColumn()).fill('');Object.entries(entry).forEach(([k,v])=>values[map[k]]=v);
    ev.appendRow(values);
    ass.getRange(a.row,portal27Col_(ass,'Status')).setValue('COMPLETED');
    const mm=portal27Map_(master);
    if(mm['Evaluation Status']!==undefined)master.getRange(m.row,mm['Evaluation Status']+1).setValue('COMPLETED');
    if(mm['Evaluation Score']!==undefined)master.getRange(m.row,mm['Evaluation Score']+1).setValue(entry['Weighted Score']);
    if(mm['Evaluated At']!==undefined)master.getRange(m.row,mm['Evaluated At']+1).setValue(now);
    SpreadsheetApp.flush();
    return {ok:true,posterId:id,score:entry['Weighted Score']};
  }finally{lock.releaseLock();}
}
function portal27HealthCheck(){
  const user=portal27Role_();if(user.role==='none')return {user,ready:false,message:'Not authorised for dashboard access.'};
  const ss=portal27SS_(),names=[PORTAL27.master,PORTAL27.config,PORTAL27.assignments,PORTAL27.evaluations];
  return {user,ready:true,sheets:names.map(name=>({name,rows:portal27Sheet_(ss,name).getLastRow()}))};
}
