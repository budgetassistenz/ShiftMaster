/**
 * ShiftCare v6.5 – Schichtplaner für 24h-Pflege / Persönliches Budget
 */

import React, { useState, Fragment, useMemo, useCallback, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────
// KONSTANTEN
// ─────────────────────────────────────────────────────────────────

const PALETTE = ["#0EA5E9","#8B5CF6","#10B981","#F59E0B","#EF4444","#EC4899","#6366F1","#84CC16","#F97316","#06B6D4","#A855F7","#14B8A6"];
const MONTHS_DE  = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DAYS_SHORT = ["Mo","Di","Mi","Do","Fr","Sa","So"];
const DAYS_LONG  = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];

const BUNDESLAENDER = {
  BW:"Baden-Württemberg", BY:"Bayern", BE:"Berlin", BB:"Brandenburg",
  HB:"Bremen", HH:"Hamburg", HE:"Hessen", MV:"Mecklenburg-Vorpommern",
  NI:"Niedersachsen", NW:"Nordrhein-Westfalen", RP:"Rheinland-Pfalz",
  SL:"Saarland", SN:"Sachsen", ST:"Sachsen-Anhalt", SH:"Schleswig-Holstein",
  TH:"Thüringen",
};

const FREISTELLUNG_TYPES = {
  unpaid:   { label:"Unbezahlter Urlaub",      color:"#F59E0B", badge:"#FFFBEB", badgeT:"#92400E" },
  eltern:   { label:"Elternzeit",              color:"#8B5CF6", badge:"#EDE9FE", badgeT:"#5B21B6" },
  longSick: { label:"Krankenstand (Langzeit)", color:"#EF4444", badge:"#FEF2F2", badgeT:"#991B1B" },
  pause:    { label:"Vertragspause",           color:"#64748B", badge:"#F1F5F9", badgeT:"#334155" },
};

const CLEAN_INTERVALS = [
  { value:"daily", label:"Täglich" }, { value:"weekly", label:"Wöchentlich" },
  { value:"monthly", label:"Monatlich" }, { value:"once", label:"Einmalig" },
];

const NOTIF_TYPES = {
  vacation_overlap: { icon:"🏖️", color:"#F59E0B" },
  sick_submitted:   { icon:"🤒", color:"#EF4444" },
  sick_confirmed:   { icon:"✅", color:"#10B981" },
  shift_changed:    { icon:"📋", color:"#0EA5E9" },
  vacation_decided: { icon:"📬", color:"#6366F1" },
  plan_published:   { icon:"✨", color:"#10B981" },
  shift_open:       { icon:"⚡", color:"#F97316" },
  shift_taken:      { icon:"🤝", color:"#10B981" },
};

// ─────────────────────────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────────────────────────

const daysInMonth = (y,m) => new Date(y,m,0).getDate();
const fmtDate     = (y,m,d) => `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const getWeekday  = (y,m,d) => { const w=new Date(y,m-1,d).getDay(); return w===0?6:w-1; };
const isWeekend   = (y,m,d) => getWeekday(y,m,d)>=5;
const fmt2        = n => String(n).padStart(2,"0");
const today       = () => { const d=new Date(); return fmtDate(d.getFullYear(),d.getMonth()+1,d.getDate()); };
const calcVacationDays = emp => emp.vacationDaysOverride ?? Math.round((emp.pensumPct??100)/100*30);

function easterSunday(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,
        f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
        i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m2=Math.floor((a+11*h+22*l)/451);
  const mo=Math.floor((h+l-7*m2+114)/31),dy=((h+l-7*m2+114)%31)+1;
  return new Date(year,mo-1,dy);
}

function getHolidaysByBL(year, bl="BW") {
  const e=easterSunday(year);
  const add=(d,n)=>{const r=new Date(d);r.setDate(r.getDate()+n);return r;};
  const fmt=d=>fmtDate(d.getFullYear(),d.getMonth()+1,d.getDate());
  const h={};
  // Bundesweite Feiertage
  h[`${year}-01-01`]="Neujahr";
  h[fmt(add(e,-2))]="Karfreitag";
  h[fmt(add(e,1))]="Ostermontag";
  h[`${year}-05-01`]="Tag der Arbeit";
  h[fmt(add(e,39))]="Christi Himmelfahrt";
  h[fmt(add(e,50))]="Pfingstmontag";
  h[`${year}-10-03`]="Tag der deutschen Einheit";
  h[`${year}-12-25`]="1. Weihnachtstag";
  h[`${year}-12-26`]="2. Weihnachtstag";
  // Länderspezifisch
  if(["BW","BY","ST"].includes(bl))          h[`${year}-01-06`]="Heilige Drei Könige";
  if(["BW","BY","HE","NW","RP","SL"].includes(bl)) h[fmt(add(e,60))]="Fronleichnam";
  if(["BY","SL"].includes(bl))               h[`${year}-08-15`]="Mariä Himmelfahrt";
  if(["BW","BY","NW","RP","SL"].includes(bl))h[`${year}-11-01`]="Allerheiligen";
  if(["BB","HB","HH","MV","NI","SN","ST","SH","TH"].includes(bl)) h[`${year}-10-31`]="Reformationstag";
  if(bl==="SN"){ let d=new Date(year,10,23);while(d.getDay()!==3)d.setDate(d.getDate()-1);d.setDate(d.getDate()-14);h[fmt(d)]="Buß- und Bettag"; }
  if(bl==="BE"&&year>=2019) h[`${year}-03-08`]="Internationaler Frauentag";
  if(bl==="TH"&&year>=2019) h[`${year}-09-20`]="Weltkindertag";
  if(bl==="BB"){ h[fmt(e)]="Ostersonntag"; h[fmt(add(e,49))]="Pfingstsonntag"; }
  return h;
}

/**
 * Berechnet pro Stunde ob Feiertag / Sonntag / Nacht
 * Gibt holH, sunH, nightH zurück (jeweils ganzzahlig)
 */
function calcShiftHours(startDateStr, shiftStartHour, durationH, holidayMap, nightStart, nightEnd, startsEve) {
  const [y,m,d]=startDateStr.split("-").map(Number);
  const baseDate = new Date(y, m-1, d);
  if(startsEve) baseDate.setDate(baseDate.getDate() - 1);
  let holH=0, sunH=0, nightH=0;
  for(let h=0;h<Math.floor(durationH);h++){
    const dt=new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), shiftStartHour+h);
    const ds=fmtDate(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    const hr=dt.getHours();
    const dow=dt.getDay();
    if(holidayMap[ds])      holH++;
    else if(dow===0)        sunH++;
    const isNight = nightStart>nightEnd ? (hr>=nightStart||hr<nightEnd) : (hr>=nightStart&&hr<nightEnd);
    if(isNight) nightH++;
  }
  return{holH,sunH,nightH};
}

// ─────────────────────────────────────────────────────────────────
// STARTDATEN
// ─────────────────────────────────────────────────────────────────

// DATEV LODAS Lohnarten (Standard – vom Admin in den Einstellungen anpassbar)
const DEFAULT_LODAS_LOHNARTEN = {
  grundlohn:   "101", // Grundlohn (Stundenlohn)
  feiertag:    "120", // Feiertagszuschlag (steuerfrei §3b EStG)
  sonntag:     "121", // Sonntagszuschlag (steuerfrei)
  nacht:       "122", // Nachtzuschlag (steuerfrei)
  urlaub:      "105", // Urlaubsentgelt
  efzg:        "107", // Entgeltfortzahlung Krankheit (EFZG)
  unbezahlt:   "200", // Unbezahlte Fehlzeit
  uebernahme:  "103", // Einspringen / Schichtübernahme (Info)
};

const INIT_EMP = [
  {id:1,name:"Anna M.",  pensumPct:100,color:PALETTE[0],customMaxH:null,vacationDaysOverride:null,hourlyRate:17.50,contractNote:"Vollzeit, seit 2021",preferredWeekdays:[],email:"anna.m@example.de",preferredShiftH:48,phone:"",probationEnd:"",wishFreeLimit:3,dailyContractHours:8,no24hShift:false,personalNr:"00001"},
  {id:2,name:"Maria K.", pensumPct:100,color:PALETTE[1],customMaxH:null,vacationDaysOverride:null,hourlyRate:16.50,contractNote:"Vollzeit, seit 2023",preferredWeekdays:[0,1,2],email:"maria.k@example.de",preferredShiftH:24,phone:"",probationEnd:"",wishFreeLimit:3,dailyContractHours:8,no24hShift:false,personalNr:"00002"},
  {id:3,name:"Sarah L.", pensumPct:50, color:PALETTE[2],customMaxH:null,vacationDaysOverride:null,hourlyRate:15.00,contractNote:"Teilzeit 50%, seit 2022",preferredWeekdays:[],email:"sarah.l@example.de",preferredShiftH:24,phone:"",probationEnd:"",wishFreeLimit:3,dailyContractHours:4,no24hShift:false,personalNr:"00003"},
  {id:4,name:"Lisa P.",  pensumPct:30, color:PALETTE[3],customMaxH:null,vacationDaysOverride:null,hourlyRate:14.00,contractNote:"Teilzeit 30%, seit 2024",preferredWeekdays:[],email:"lisa.p@example.de",preferredShiftH:null,phone:"",probationEnd:"2025-09-30",wishFreeLimit:3,dailyContractHours:3,no24hShift:false,personalNr:"00004"},
  {id:5,name:"Jana W.",  pensumPct:15, color:PALETTE[4],customMaxH:null,vacationDaysOverride:null,hourlyRate:12.82,contractNote:"Minijob, seit 2024", preferredWeekdays:[5,6],email:"jana.w@example.de",preferredShiftH:null,phone:"",probationEnd:"",wishFreeLimit:2,dailyContractHours:2,no24hShift:false,personalNr:"00005"},
  {id:6,name:"Eva S.",   pensumPct:10, color:PALETTE[5],customMaxH:null,vacationDaysOverride:null,hourlyRate:12.41,contractNote:"Minijob, seit 2025", preferredWeekdays:[5,6],email:"eva.s@example.de",preferredShiftH:null,phone:"",probationEnd:"2026-06-30",wishFreeLimit:2,dailyContractHours:2,no24hShift:false,personalNr:"00006"},
];

// Notfall-Kontaktliste (global, sichtbar für alle MA)
const INIT_EMERGENCY_CONTACTS = [
  {id:1,name:"Admin / Leitung",phone:"0711 / 123456",note:"Immer erreichbar"},
  {id:2,name:"Ärztlicher Bereitschaftsdienst",phone:"116 117",note:"Mo–Fr 19–7 Uhr, Wochenende ganztags"},
  {id:3,name:"Notruf",phone:"112",note:"Lebensbedrohliche Notfälle"},
];

// Wiederholende Schichtmuster (pro Arbeitgeber, pro MA)
// { [careId]: [ { id, empId, weekdays:[0-6], note } ] }
const INIT_SHIFT_PATTERNS = {};

const INIT_CARE = [
  {id:1,name:"Herr Müller", notes:"Bevorzugt weibliche Assistenz",bundesland:"BW",shiftDurationH:24,shiftStartHour:8,shiftStartsEve:false,maxConsecutiveShifts:3,minRestBetweenBlocksH:24,fullCoverage:true},
  {id:2,name:"Frau Schmidt",notes:"",bundesland:"BW",shiftDurationH:24,shiftStartHour:8,shiftStartsEve:false,maxConsecutiveShifts:3,minRestBetweenBlocksH:24,fullCoverage:true},
];

const INIT_SC   = {holiday:125,sunday:25,night:25,nightStart:22,nightEnd:6};
const INIT_LIMITS = {wishFree:3};

// ─────────────────────────────────────────────────────────────────
// RULE-BASED SCHEDULER (mit Soft-Block-Präferenz)
// ─────────────────────────────────────────────────────────────────

function generateRuleBased({employees,care,empPrefs,empConstraints,carePrefs,vacReqs,sickReqs,adminAbsence,freistellung,planPrefs,planYear,planMonth,holidayStats}) {
  const numDays=daysInMonth(planYear,planMonth);
  const result={};const warnings=[];const conflictDates=new Set();
  const freiSet=new Set();
  employees.forEach(emp=>(freistellung[emp.id]||[]).forEach(f=>{
    const s=new Date(f.startDate),e2=f.endDate?new Date(f.endDate):new Date(9999,0,1);
    const ms=new Date(planYear,planMonth-1,1),me=new Date(planYear,planMonth,0);
    if(s<=me&&e2>=ms) freiSet.add(emp.id);
  }));
  const activeEmp=employees.filter(e=>!freiSet.has(e.id));
  if(!activeEmp.length) return{schedule:{},warnings:["Keine aktiven Mitarbeiter!"],conflictDates};
  const adminAbsDates=new Set(adminAbsence[planYear]?.[planMonth]||[]);

  // Blocked dates (Urlaub + Krank + Kann-nicht = hart; Kann-Tage = Verfügbarkeitsfenster hart)
  const blockedDates={};
  activeEmp.forEach(emp=>{
    const p=empPrefs[emp.id]?.[planYear]?.[planMonth]||{};
    const cnt=empConstraints[emp.id]?.[planYear]?.[planMonth]||{};
    const vacOk=new Set((vacReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="approved").flatMap(r=>(r.adminDates||r.dates)));
    const sickOk=new Set((sickReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="confirmed").flatMap(r=>r.dates));
    const canDates=cnt.canDates||new Set();
    // canDates = "Kann"-Tage: wenn gesetzt, darf MA nur an diesen Tagen eingeplant werden
    const canOnlyBlock=canDates.size>0
      ?new Set(Array.from({length:numDays},(_,i)=>fmtDate(planYear,planMonth,i+1)).filter(d=>!canDates.has(d)))
      :new Set();
    // Wunsch-Frei ist weiches Kriterium für den Algorithmus (wird im Scoring bestraft, nicht gesperrt)
    blockedDates[emp.id]={hard:new Set([...vacOk,...sickOk,...canOnlyBlock]),soft:p.wishOff||new Set()};
  });

  const totalSollH=activeEmp.reduce((a,e)=>a+Math.round((e.pensumPct??100)/100*160),0);
  // Feier-/Sonntags-Fairness: vorherige Zuteilungen im Jahr berücksichtigen
  const yearHolCount={},yearSunCount={};
  activeEmp.forEach(e=>{
    yearHolCount[e.id]=holidayStats?.[e.id]?.hol||0;
    yearSunCount[e.id]=holidayStats?.[e.id]?.sun||0;
  });

  care.forEach(c=>{
    result[c.id]=[];
    const shiftH=c.shiftDurationH;
    const spanDays=Math.ceil(shiftH/24);
    const shiftsPerDay=c.fullCoverage!==false?Math.ceil(24/shiftH):1;
    const carePrefsMonth=carePrefs[c.id]?.[planYear]?.[planMonth]||{};
    const assignedH={},consec={},lastDay={};
    activeEmp.forEach(e=>{assignedH[e.id]=0;consec[e.id]=0;lastDay[e.id]=-999;});

    let day=1;
    while(day<=numDays){
      const date=fmtDate(planYear,planMonth,day);
      if(adminAbsDates.has(date)){day+=spanDays;continue;}

      for(let slot=0;slot<shiftsPerDay;slot++){
      const busyElsewhere=new Set();
      const busyThisSlot=new Set();
      // Check other care assignments
      Object.entries(result).forEach(([cId,shifts])=>{
        if(Number(cId)===c.id) return;
        shifts.forEach(s=>{
          const[sy,sm,sd]=s.startDate.split("-").map(Number);
          for(let i=0;i<Math.ceil(s.durationH/24);i++){
            if(fmtDate(sy,sm,sd+i)===date) busyElsewhere.add(s.employeeId);
          }
        });
      });
      // Check same-care earlier slots this day
      result[c.id].forEach(s=>{
        if(s.startDate===date) busyThisSlot.add(s.employeeId);
      });
      const prefEmpId=slot===0?carePrefsMonth[date]:null;
      let chosen=null,isConflict=false,conflictReason="";
      if(prefEmpId){
        const prefEmp=activeEmp.find(e=>e.id===prefEmpId);
        if(prefEmp&&!blockedDates[prefEmpId]?.hard.has(date)&&!busyElsewhere.has(prefEmpId)&&!busyThisSlot.has(prefEmpId)) chosen=prefEmp;
        else{
          const reason=blockedDates[prefEmpId]?.hard.has(date)?"Urlaub/Krank/Verfügbarkeit":busyElsewhere.has(prefEmpId)?"bereits anderweitig eingeplant":"nicht verfügbar";
          conflictReason=`Arbeitgeber-Wunsch: ${prefEmp?.name||"MA"} – ${reason}`;
          warnings.push(`[WUNSCHKONFLIKT] ⚠️ ${c.name} am ${date}: ${conflictReason}`);
          isConflict=true;conflictDates.add(date);
        }
      }
      if(!chosen){
        const hardCandidates=activeEmp.filter(emp=>{
          if(blockedDates[emp.id].hard.has(date)) return false;
          if(busyElsewhere.has(emp.id)||busyThisSlot.has(emp.id)) return false;
          const maxH=emp.customMaxH??Math.round((emp.pensumPct??100)/100*160);
          if(assignedH[emp.id]+shiftH>maxH*1.1) return false;
          if(consec[emp.id]>=c.maxConsecutiveShifts&&lastDay[emp.id]===day-spanDays) return false;
          return true;
        });
        const allCandidates=hardCandidates.length>0?hardCandidates:activeEmp.filter(emp=>{
          if(blockedDates[emp.id].hard.has(date)) return false;
          if(busyElsewhere.has(emp.id)||busyThisSlot.has(emp.id)) return false;
          if(consec[emp.id]>=c.maxConsecutiveShifts&&lastDay[emp.id]===day-spanDays) return false;
          return true;
        });
        // Conflict: nur MA mit Stundenüberschreitung verfügbar
        if(hardCandidates.length===0&&allCandidates.length>0){
          const overNames=allCandidates.map(e=>e.name).join(", ");
          conflictReason=`Nur MA mit Stundenüberschreitung verfügbar (${overNames})`;
          warnings.push(`[STUNDENÜBERSCHREITUNG] ⚠️ ${c.name} am ${date}: ${conflictReason}`);
          isConflict=true;conflictDates.add(date);
        }
        // Conflict: Wunsch-Frei wird überschrieben (nur wenn tatsächlich wishOff gesetzt)
        if(allCandidates.length>0){
          const allHaveWishOff=allCandidates.every(e=>blockedDates[e.id].soft.has(date));
          const anyHasWishOff=allCandidates.some(e=>blockedDates[e.id].soft.has(date));
          if(allHaveWishOff&&anyHasWishOff){
            conflictReason=`Alle verfügbaren MA haben Wunsch-Frei eingetragen`;
            warnings.push(`[WUNSCH-ÜBERSCHREIBUNG] 🔶 ${c.name} am ${date}: ${conflictReason}`);
            isConflict=true;conflictDates.add(date);
          }
        }
        if(!allCandidates.length){
          const hardBlocked=activeEmp.filter(e=>blockedDates[e.id]?.hard.has(date)).map(e=>e.name);
          const busyBlocked=[...busyElsewhere,...busyThisSlot].map(id=>activeEmp.find(e=>e.id===id)?.name).filter(Boolean);
          conflictReason=`Kein MA verfügbar${hardBlocked.length?` (gesperrt: ${hardBlocked.join(", ")})`:""}${busyBlocked.length?` (belegt: ${busyBlocked.join(", ")})`:""}`;
          warnings.push(`[KEIN PERSONAL] ❌ ${c.name} am ${date} Slot ${slot+1}: ${conflictReason}`);
          isConflict=true;conflictDates.add(date);
          result[c.id].push({startDate:date,durationH:shiftH,employeeId:null,conflict:true,conflictReason,open:true,slot});
          continue;
        }

        // Scoring – Block-Kontinuität hat hohe Priorität
        const scoreEmp=(emp)=>{
          const maxH=emp.customMaxH??Math.round((emp.pensumPct??100)/100*160);
          const targetH=(maxH/totalSollH)*(numDays*24/care.length);
          const p=empPrefs[emp.id]?.[planYear]?.[planMonth]||{};
          const wantWork=(p.wishWork||new Set()).has?.(date)||false;
          const prefWD=(emp.preferredWeekdays||[]).includes(getWeekday(planYear,planMonth,day));
          const wishOffPenalty=blockedDates[emp.id].soft.has(date)?-15:0;
          // Block-Scoring: bevorzugter Block = preferredShiftH / shiftH Schichten am Stück
          const prefBlock=emp.preferredShiftH?Math.max(1,Math.round(emp.preferredShiftH/shiftH)):1;
          const isContinuing=lastDay[emp.id]===day-spanDays&&consec[emp.id]>0;
          const blockIncomplete=isContinuing&&consec[emp.id]<prefBlock;
          const blockBonus=blockIncomplete?40:0; // Sehr starker Bonus für Block-Fortsetzung
          const balanceFactor=(targetH-assignedH[emp.id])*2;
          // Feier-/Sonntag-Fairness: wer weniger hatte, bevorzugen (gewichtet nach Pensum)
          const fairBias=-(yearHolCount[emp.id]+yearSunCount[emp.id])*(emp.pensumPct/100)*2;
          // no24hShift: MA bevorzugt nur in Folgeblöcken (2×/3×24h) – Einzelschicht stark bestrafen
          const iso24hPenalty=(emp.no24hShift&&shiftH>=24&&!isContinuing)?-30:0;
          return balanceFactor+blockBonus+(wantWork?12:0)+(prefWD?3:0)+wishOffPenalty+fairBias+iso24hPenalty;
        };
        chosen=allCandidates.reduce((best,emp)=>scoreEmp(emp)>scoreEmp(best)?emp:best);
      }
      if(chosen){
        result[c.id].push({startDate:date,durationH:shiftH,employeeId:chosen.id,conflict:isConflict,conflictReason:isConflict?conflictReason:"",open:false,slot});
        assignedH[chosen.id]+=shiftH;
        if(lastDay[chosen.id]===day-spanDays) consec[chosen.id]++; else consec[chosen.id]=1;
        lastDay[chosen.id]=day;
      }
      } // end slot loop
      day+=spanDays;
    }
  });
  // Post-generation checks
  const assignedFinal={};
  activeEmp.forEach(e=>assignedFinal[e.id]=0);
  Object.values(result).forEach(shifts=>shifts.forEach(s=>{if(s.employeeId&&assignedFinal[s.employeeId]!==undefined)assignedFinal[s.employeeId]+=s.durationH;}));
  activeEmp.forEach(e=>{
    const maxH=e.customMaxH??Math.round((e.pensumPct??100)/100*160);
    const ist=assignedFinal[e.id]||0;
    if(ist>maxH*1.15) warnings.push(`[STUNDENÜBERSCHREITUNG] ⏱️ ${e.name}: ${ist}h geplant, Soll ${maxH}h (+${Math.round((ist/maxH-1)*100)}%)`);
    if(ist<maxH*0.5&&ist>0) warnings.push(`[STUNDENÜBERSCHREITUNG] ⏱️ ${e.name}: Nur ${ist}h geplant, Soll ${maxH}h (${Math.round(ist/maxH*100)}%)`);
  });
  return{schedule:result,warnings,conflictDates};
}

// ─────────────────────────────────────────────────────────────────
// CLOUD SYNC – IONOS S3 (primär) + Firebase (optional) + localStorage
// ─────────────────────────────────────────────────────────────────

// ┌──────────────────────────────────────────────────────────────────┐
// │  IONOS S3 Object Storage (EU, DSGVO-konform)                     │
// │  Konfiguration im Admin-Bereich unter Team & Setup → Cloud-Sync  │
// │  Bucket muss CORS für deine Domain erlauben.                     │
// └──────────────────────────────────────────────────────────────────┘

const IONOS_REGION = "eu-central-1"; // Frankfurt – DSGVO-konform
const IONOS_S3_HOST = (bucket) => `${bucket}.s3.${IONOS_REGION}.ionoscloud.com`;
const IONOS_OBJECT_KEY = "shiftcare_v6_state.json";

// AWS Signature V4 für IONOS S3 (SubtleCrypto API – kein externer Build nötig)
async function _sha256hex(data) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function _hmac(key, data) {
  const k = key instanceof Uint8Array ? key : new TextEncoder().encode(key);
  const ck = await crypto.subtle.importKey("raw", k, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", ck, new TextEncoder().encode(data)));
}
function _hex(arr) { return Array.from(arr).map(b=>b.toString(16).padStart(2,"0")).join(""); }

async function ionosS3Fetch(method, bucket, accessKey, secretKey, bodyStr = "") {
  const host = IONOS_S3_HOST(bucket);
  const path = `/${IONOS_OBJECT_KEY}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 16) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await _sha256hex(bodyStr);
  const hdrs = {
    host, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash,
    ...(bodyStr ? {"content-type": "application/json"} : {}),
  };
  const sorted = Object.keys(hdrs).sort();
  const canonHdrs = sorted.map(k=>`${k}:${hdrs[k]}\n`).join("");
  const signedHdrs = sorted.join(";");
  const canonReq = [method, path, "", canonHdrs, signedHdrs, payloadHash].join("\n");
  const scope = `${dateStamp}/${IONOS_REGION}/s3/aws4_request`;
  const s2s = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await _sha256hex(canonReq)}`;
  const k1=await _hmac(`AWS4${secretKey}`,dateStamp);
  const k2=await _hmac(k1,IONOS_REGION);
  const k3=await _hmac(k2,"s3");
  const k4=await _hmac(k3,"aws4_request");
  const sig = _hex(await _hmac(k4, s2s));
  const auth = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHdrs}, Signature=${sig}`;
  return fetch(`https://${host}${path}`, {
    method, body: bodyStr || undefined,
    headers: { ...hdrs, Authorization: auth },
  });
}

async function saveToIONOS(state, cfg) {
  if (!cfg?.bucket || !cfg?.accessKey || !cfg?.secretKey) return false;
  try {
    const r = await ionosS3Fetch("PUT", cfg.bucket, cfg.accessKey, cfg.secretKey, serializeState(state));
    return r.ok;
  } catch(e) { console.warn("IONOS Save:", e.message); return false; }
}

async function loadFromIONOS(cfg) {
  if (!cfg?.bucket || !cfg?.accessKey || !cfg?.secretKey) return null;
  try {
    const r = await ionosS3Fetch("GET", cfg.bucket, cfg.accessKey, cfg.secretKey);
    if (!r.ok) return null;
    return deserializeState(await r.text());
  } catch(e) { console.warn("IONOS Load:", e.message); return null; }
}

// Firebase (optional, Fallback)
const FIREBASE_CONFIG = null;
let _db = null;
let _firebaseReady = false;
async function initFirebase() {
  if (!FIREBASE_CONFIG || _firebaseReady) return _firebaseReady;
  try {
    const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getFirestore, doc, setDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    _db = { db: getFirestore(app), doc, setDoc, getDoc };
    _firebaseReady = true;
  } catch(e) { _firebaseReady = false; }
  return _firebaseReady;
}
const TEAM_ID = "team_default";
async function saveToFirebase(state) {
  if (!_db) return false;
  try { const{db,doc,setDoc}=_db; await setDoc(doc(db,"teams",TEAM_ID),{data:serializeState(state),updatedAt:Date.now()}); return true; }
  catch(e) { return false; }
}
async function loadFromFirebase() {
  if (!_db) return null;
  try { const{db,doc,getDoc}=_db; const s=await getDoc(doc(db,"teams",TEAM_ID)); return s.exists()?deserializeState(s.data().data):null; }
  catch(e) { return null; }
}

function serializeState(s){ return JSON.stringify(s,(_,v)=>v instanceof Set?{__type:"Set",values:[...v]}:v); }
function deserializeState(str){ return JSON.parse(str,(_,v)=>v&&v.__type==="Set"?new Set(v.values):v); }

// ─────────────────────────────────────────────────────────────────
// EMAIL HELPER
// ─────────────────────────────────────────────────────────────────

// ── BACKEND API CLIENT ─────────────────────────────────────────────
const BackendAPI={
  _url:null,_token:null,_refresh:null,
  configure(url){this._url=url?.replace(/\/$/,"")||null;},
  isConfigured(){return!!this._url;},
  setTokens(token,refresh){this._token=token;this._refresh=refresh;try{if(token)localStorage.setItem("sc_api_token",token);if(refresh)localStorage.setItem("sc_api_refresh",refresh);}catch{}},
  clearTokens(){this._token=null;this._refresh=null;try{localStorage.removeItem("sc_api_token");localStorage.removeItem("sc_api_refresh");}catch{}},
  restoreSession(){try{this._url=localStorage.getItem("sc_api_url")||null;this._token=localStorage.getItem("sc_api_token")||null;this._refresh=localStorage.getItem("sc_api_refresh")||null;return!!this._token;}catch{return false;}},
  async _fetch(path,opts={}){
    if(!this._url)return null;
    const headers={"Content-Type":"application/json",...(this._token?{Authorization:`Bearer ${this._token}`}:{})};
    try{
      let r=await fetch(`${this._url}${path}`,{...opts,headers});
      if(r.status===401&&this._refresh){
        const ref=await fetch(`${this._url}/api/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refreshToken:this._refresh})});
        if(ref.ok){const d=await ref.json();this.setTokens(d.token,d.refreshToken);headers.Authorization=`Bearer ${d.token}`;r=await fetch(`${this._url}${path}`,{...opts,headers});}
        else{this.clearTokens();return{error:"session_expired"};}
      }
      if(!r.ok)return{error:`HTTP ${r.status}`,status:r.status};
      return await r.json();
    }catch(e){return{error:e.message};}
  },
  async login(email,password){
    const r=await this._fetch("/api/auth/login",{method:"POST",body:JSON.stringify({email,password})});
    if(r?.token){this.setTokens(r.token,r.refreshToken);}
    return r;
  },
  async loadState(){return this._fetch("/api/state");},
  async saveState(data){return this._fetch("/api/state",{method:"PUT",body:JSON.stringify({data})});},
  async logout(){const r=await this._fetch("/api/auth/logout",{method:"POST"});this.clearTokens();return r;},
};

function openEmail(client,to,subject,body){
  const enc=encodeURIComponent;
  if(client==="gmail")   window.open(`https://mail.google.com/mail/?view=cm&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`,"_blank");
  else if(client==="outlook") window.open(`https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,"_blank");
  else window.location.href=`mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
}

// ─────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────

const THEMES={
  light:{
    '--sc-bg':'#F8FAFC','--sc-card':'#FFFFFF','--sc-border':'#E2E8F0','--sc-border-2':'#F1F5F9',
    '--sc-text':'#1E293B','--sc-text-2':'#475569','--sc-text-3':'#94A3B8',
    '--sc-hdr':'#FFFFFF','--sc-hdr-shadow':'0 1px 3px rgba(0,0,0,.05)',
    '--sc-accent':'#0EA5E9','--sc-accent-h':'#0284C7','--sc-accent-bg':'#EFF6FF','--sc-accent-bg2':'rgba(14,165,233,.08)',
    '--sc-input':'#FFFFFF','--sc-input-border':'#E2E8F0','--sc-subtle':'#F8FAFC',
    '--sc-green':'#10B981','--sc-green-bg':'#F0FDF4','--sc-red':'#EF4444','--sc-red-bg':'#FEF2F2',
    '--sc-warn':'#F59E0B','--sc-warn-bg':'#FFFBEB','--sc-purple':'#6366F1','--sc-purple-bg':'#F5F3FF',
    '--sc-login-bg':'linear-gradient(135deg,#0F172A,#1E293B 50%,#0F172A)','--sc-login-card':'#FFFFFF',
    '--sc-shadow':'0 1px 3px rgba(0,0,0,.06)','--sc-shadow-lg':'0 8px 32px rgba(0,0,0,.1)',
    '--sc-overlay':'rgba(15,23,42,.45)',
  },
  dark:{
    '--sc-bg':'#0F172A','--sc-card':'#1E293B','--sc-border':'#334155','--sc-border-2':'#1E293B',
    '--sc-text':'#F1F5F9','--sc-text-2':'#CBD5E1','--sc-text-3':'#64748B',
    '--sc-hdr':'#1E293B','--sc-hdr-shadow':'0 1px 3px rgba(0,0,0,.3)',
    '--sc-accent':'#38BDF8','--sc-accent-h':'#0EA5E9','--sc-accent-bg':'rgba(56,189,248,.1)','--sc-accent-bg2':'rgba(56,189,248,.06)',
    '--sc-input':'#0F172A','--sc-input-border':'#475569','--sc-subtle':'#1E293B',
    '--sc-green':'#34D399','--sc-green-bg':'rgba(52,211,153,.1)','--sc-red':'#FB7185','--sc-red-bg':'rgba(251,113,133,.1)',
    '--sc-warn':'#FBBF24','--sc-warn-bg':'rgba(251,191,36,.1)','--sc-purple':'#818CF8','--sc-purple-bg':'rgba(129,140,248,.1)',
    '--sc-login-bg':'linear-gradient(135deg,#020617,#0F172A 50%,#020617)','--sc-login-card':'#1E293B',
    '--sc-shadow':'0 1px 3px rgba(0,0,0,.3)','--sc-shadow-lg':'0 8px 32px rgba(0,0,0,.4)',
    '--sc-overlay':'rgba(0,0,0,.6)',
  },
  colorful:{
    '--sc-bg':'#FAFAF9','--sc-card':'#FFFFFF','--sc-border':'#E7E5E4','--sc-border-2':'#F5F5F4',
    '--sc-text':'#1C1917','--sc-text-2':'#57534E','--sc-text-3':'#A8A29E',
    '--sc-hdr':'linear-gradient(135deg,#0EA5E9,#8B5CF6)','--sc-hdr-shadow':'0 2px 8px rgba(99,102,241,.2)',
    '--sc-accent':'#8B5CF6','--sc-accent-h':'#7C3AED','--sc-accent-bg':'#F5F3FF','--sc-accent-bg2':'rgba(139,92,246,.06)',
    '--sc-input':'#FFFFFF','--sc-input-border':'#E7E5E4','--sc-subtle':'#FAFAF9',
    '--sc-green':'#10B981','--sc-green-bg':'#ECFDF5','--sc-red':'#F43F5E','--sc-red-bg':'#FFF1F2',
    '--sc-warn':'#F59E0B','--sc-warn-bg':'#FFFBEB','--sc-purple':'#8B5CF6','--sc-purple-bg':'#F5F3FF',
    '--sc-login-bg':'linear-gradient(135deg,#4F46E5,#7C3AED 40%,#EC4899)','--sc-login-card':'#FFFFFF',
    '--sc-shadow':'0 1px 4px rgba(0,0,0,.06)','--sc-shadow-lg':'0 8px 32px rgba(99,102,241,.12)',
    '--sc-overlay':'rgba(15,23,42,.45)',
  },
};

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--sc-bg);color:var(--sc-text);font-size:14px;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:var(--sc-bg)}::-webkit-scrollbar-thumb{background:var(--sc-border);border-radius:3px}

.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--sc-login-bg)}
.login-card{background:var(--sc-login-card);border-radius:20px;padding:48px 40px;width:100%;max-width:460px;box-shadow:0 25px 60px rgba(0,0,0,.25);max-height:92vh;overflow-y:auto;color:var(--sc-text)}
.login-logo{display:flex;align-items:center;gap:12px;margin-bottom:32px;justify-content:center}
.login-logo-icon{background:linear-gradient(135deg,#0EA5E9,#6366F1);color:#fff;width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700}
.login-logo-text{font-size:22px;font-weight:700;color:var(--sc-text)}
.login-title{font-size:11px;font-weight:700;color:var(--sc-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px;text-align:center}
.login-btn{width:100%;padding:13px 18px;border-radius:12px;border:none;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;transition:all .2s;display:flex;align-items:center;gap:10px;margin-bottom:8px}
.login-btn-admin{background:linear-gradient(135deg,#0EA5E9,#6366F1);color:#fff}
.login-btn-admin:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(14,165,233,.3)}
.login-btn-emp{background:var(--sc-subtle);color:var(--sc-text);border:1px solid var(--sc-border)}
.login-btn-emp:hover{background:var(--sc-accent-bg)}
.login-sep{border:none;border-top:1px solid var(--sc-border);margin:18px 0}

.dlg-overlay{position:fixed;inset:0;background:var(--sc-overlay);z-index:999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.dlg{background:var(--sc-card);border-radius:16px;padding:28px 32px;max-width:500px;width:92%;box-shadow:var(--sc-shadow-lg);animation:dlg-in .15s ease;max-height:88vh;overflow-y:auto;color:var(--sc-text)}
@keyframes dlg-in{from{opacity:0;transform:scale(.96) translateY(4px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes bell-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.popup-overlay{position:fixed;inset:0;z-index:500;background:transparent}
@media(max-width:640px){.popup-overlay{background:rgba(0,0,0,.3)}}
.shift-popup{position:fixed;background:var(--sc-card);border-radius:14px;box-shadow:var(--sc-shadow-lg);border:1px solid var(--sc-border);min-width:220px;z-index:501;overflow:hidden;animation:dlg-in .12s ease;max-height:70vh;overflow-y:auto}
@media(max-width:640px){.shift-popup{left:8px !important;right:8px !important;bottom:8px !important;top:auto !important;border-radius:16px 16px 12px 12px;min-width:auto;max-width:none;width:auto}}
.shift-popup-hdr{padding:10px 14px;background:var(--sc-subtle);border-bottom:1px solid var(--sc-border);font-size:11px;font-weight:700;color:var(--sc-text-3);text-transform:uppercase;letter-spacing:.05em}
.shift-popup-emp{width:100%;padding:12px 14px;border:none;background:transparent;cursor:pointer;font-size:13px;font-family:inherit;display:flex;align-items:center;gap:8px;transition:background .1s;text-align:left;color:var(--sc-text)}
.shift-popup-emp:hover{background:var(--sc-accent-bg)}.shift-popup-emp.current{background:var(--sc-accent-bg);font-weight:700}
.shift-popup-del{width:100%;padding:9px 14px;border:none;background:transparent;cursor:pointer;font-size:12px;font-family:inherit;display:flex;align-items:center;gap:8px;color:var(--sc-red);transition:background .1s}
.shift-popup-del:hover{background:var(--sc-red-bg)}

.sc{min-height:100vh}
.sc-hdr{background:var(--sc-hdr);border-bottom:1px solid var(--sc-border);padding:0 20px;display:flex;align-items:center;height:56px;gap:10;position:sticky;top:0;z-index:200;box-shadow:var(--sc-hdr-shadow)}
.sc-logo{font-size:14px;font-weight:700;color:var(--sc-accent);display:flex;align-items:center;gap:8px;margin-right:12px;white-space:nowrap;flex-shrink:0}
.sc-logo-icon{background:linear-gradient(135deg,#0EA5E9,#6366F1);color:#fff;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;font-weight:700}
.sc-main{padding:24px 20px;max-width:1440px;margin:0 auto}
.sc-nav{padding:5px 10px;border-radius:7px;border:none;background:transparent;color:var(--sc-text-2);cursor:pointer;font-size:11px;font-weight:500;display:flex;align-items:center;gap:4px;font-family:inherit;transition:all .15s;white-space:nowrap;flex-shrink:0;position:relative}
.sc-nav:hover{background:var(--sc-accent-bg);color:var(--sc-text)}.sc-nav.on{background:var(--sc-accent-bg);color:var(--sc-accent);font-weight:600}
.sc-month-bar{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}
.role-badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.role-admin{background:var(--sc-purple-bg);color:var(--sc-purple)}.role-emp{background:var(--sc-green-bg);color:var(--sc-green)}
.notif-badge{position:absolute;top:3px;right:3px;background:var(--sc-red);color:#fff;border-radius:999px;font-size:9px;font-weight:700;min-width:16px;height:16px;display:flex;align-items:center;justify-content:center;padding:0 3px}

.sc-card{background:var(--sc-card);border-radius:12px;border:1px solid var(--sc-border);padding:20px;box-shadow:var(--sc-shadow);transition:box-shadow .2s}
.sc-h2{font-size:14px;font-weight:700;color:var(--sc-text);margin-bottom:14px;letter-spacing:-.01em}
.sc-row{display:flex;align-items:center;gap:8px}
.sc-col{display:flex;flex-direction:column;gap:8px}
.sc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.sc-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.sc-input{border:1px solid var(--sc-input-border);border-radius:8px;padding:7px 11px;font-size:12px;font-family:inherit;color:var(--sc-text);outline:none;background:var(--sc-input);transition:border .15s,box-shadow .15s;width:100%}
.sc-input:focus{border-color:var(--sc-accent);box-shadow:0 0 0 3px var(--sc-accent-bg2)}
.sc-sel{border:1px solid var(--sc-input-border);border-radius:8px;padding:7px 11px;font-size:12px;font-family:inherit;color:var(--sc-text);outline:none;background:var(--sc-input);cursor:pointer}
.sc-btn{padding:7px 14px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .15s;letter-spacing:-.005em}
.sc-btn:disabled{opacity:.45;cursor:not-allowed}
.sc-btn-p{background:var(--sc-accent);color:#fff}.sc-btn-p:not(:disabled):hover{background:var(--sc-accent-h);transform:translateY(-1px);box-shadow:0 2px 8px rgba(14,165,233,.25)}
.sc-btn-s{background:var(--sc-subtle);color:var(--sc-text-2);border:1px solid var(--sc-border)}.sc-btn-s:hover{background:var(--sc-accent-bg);color:var(--sc-accent);border-color:var(--sc-accent)}
.sc-btn-g{background:var(--sc-green);color:#fff}.sc-btn-g:not(:disabled):hover{background:#059669;transform:translateY(-1px)}
.sc-btn-r{background:var(--sc-red);color:#fff}.sc-btn-r:hover{background:#DC2626}
.sc-btn-o{background:var(--sc-warn);color:#fff}.sc-btn-o:not(:disabled):hover{background:#D97706}
.sc-badge{padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap}
.sc-div{border:none;border-top:1px solid var(--sc-border-2);margin:12px 0}

.al{padding:10px 14px;border-radius:8px;font-size:12px;line-height:1.5}
.al-info{background:var(--sc-accent-bg);color:#1E40AF;border:1px solid #BFDBFE}
.al-warn{background:var(--sc-warn-bg);color:#92400E;border:1px solid #FDE68A}
.al-ok{background:var(--sc-green-bg);color:#065F46;border:1px solid #A7F3D0}
.al-err{background:var(--sc-red-bg);color:#991B1B;border:1px solid #FECACA}
.al-pur{background:var(--sc-purple-bg);color:#4C1D95;border:1px solid #DDD6FE}
.al-or{background:#FFF7ED;color:#9A3412;border:1px solid #FED7AA}

.emp-card{background:var(--sc-subtle);border-radius:10px;border:1px solid var(--sc-border);overflow:hidden;margin-bottom:4px}
.emp-card-head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;user-select:none}
.emp-card-body{padding:14px;border-top:1px solid var(--sc-border);display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lbl{font-size:10px;font-weight:600;color:var(--sc-text-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.wd-row{display:flex;gap:4px;flex-wrap:wrap}
.wd-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--sc-border);background:var(--sc-subtle);color:var(--sc-text-2);font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;flex-shrink:0;font-family:inherit}

.tbl-wrap{overflow-x:auto;border-radius:8px;border:1px solid var(--sc-border);position:relative;-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
.td-today{background:rgba(14,165,233,.06) !important}
.sc-tbl{border-collapse:separate;border-spacing:0;font-size:11px;min-width:100%}
.sc-tbl th{background:var(--sc-subtle);border:1px solid var(--sc-border);padding:5px 3px;font-weight:600;text-align:center;white-space:nowrap;font-size:10px;color:var(--sc-text-2);min-width:32px;position:relative}
.sc-tbl td{border:1px solid var(--sc-border);padding:2px;vertical-align:middle;height:36px;position:relative}
.sc-tbl .name-cell{padding:6px 10px;font-weight:600;font-size:11px;white-space:nowrap;background:var(--sc-card);min-width:130px;color:var(--sc-text);position:sticky;left:0;z-index:2;box-shadow:2px 0 4px rgba(0,0,0,.06)}
.th-hday{background:#FEF9C3!important;color:#A16207!important}
.th-wknd{background:#FFF7ED!important;color:#C2410C!important}
.th-admin-abs{background:var(--sc-subtle)!important;color:var(--sc-text-3)!important}

.cell-off{background:rgba(254,226,226,.65)!important}
.cell-vac{background:rgba(254,249,195,.75)!important}
.cell-work{background:rgba(220,252,231,.65)!important}
.cell-sick{background:rgba(254,215,170,.75)!important}
.cell-cannot{background:rgba(249,115,22,.12)!important}

.shift-blk{border-radius:6px;padding:3px 6px;font-size:10px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:space-between;height:26px;width:100%;user-select:none}
.shift-blk-wrap{cursor:pointer;width:100%;height:28px;padding:1px;border-radius:6px;position:relative}
.shift-blk-wrap:hover .shift-blk{filter:brightness(1.1);box-shadow:0 2px 8px rgba(0,0,0,.15)}
.shift-blk.conflict{outline:2px dashed var(--sc-red);outline-offset:1px}
.shift-open-banner{background:#F97316;color:#fff;border-radius:5px;font-size:9px;font-weight:700;padding:1px 5px;text-align:center;width:100%;display:block}

.wish-off-overlay{background:rgba(239,68,68,.18)!important}
.wish-work-overlay{background:rgba(16,185,129,.18)!important}
.wish-cannot-overlay{background:rgba(249,115,22,.15)!important}

.cal-hdr{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-day{height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;cursor:pointer;transition:all .1s;background:var(--sc-subtle);color:var(--sc-text-2);position:relative}
.cal-day:hover{background:var(--sc-accent-bg)}
.cal-day.wknd{color:var(--sc-text-3)}.cal-day.off{background:#FEE2E2;color:#991B1B;font-weight:700}
.cal-day.work{background:#DCFCE7;color:#166634;font-weight:700}
.cal-day.vac{background:#FEF9C3;color:#854D0E;font-weight:700}
.cal-day.sick{background:#FED7AA;color:#9A3412;font-weight:700}
.cal-day.hol{background:#FDE68A;color:#92400E}
.cal-day.abs{background:var(--sc-border-2);color:var(--sc-text-3);cursor:default}
.cal-day.cannot{background:#FFF0E6;color:#C2410C;font-weight:700;border:2px solid #F97316!important}
.cal-day.canwork{background:#E8F5FF!important;color:#0369A1!important;font-weight:700;border:2px solid #0EA5E9!important}

.vac-req{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--sc-subtle);border-radius:8px;border:1px solid var(--sc-border);flex-wrap:wrap}
.vac-req.pending{border-left:3px solid var(--sc-warn)}.vac-req.approved{border-left:3px solid var(--sc-green)}.vac-req.rejected{border-left:3px solid var(--sc-red)}

.prog{background:var(--sc-border-2);border-radius:20px;height:6px;overflow:hidden}
.prog-bar{height:100%;border-radius:20px;transition:width .4s}
.sc-box{background:var(--sc-subtle);border-radius:10px;padding:14px;border-left:4px solid}
.pct-inp{border:1px solid var(--sc-input-border);border-radius:6px;padding:6px 10px;font-size:15px;font-family:'JetBrains Mono',monospace;font-weight:700;width:72px;text-align:center;outline:none;background:var(--sc-input);color:var(--sc-text)}
.pct-inp:focus{border-color:var(--sc-accent)}

.clean-task{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:8px;border:1px solid var(--sc-border);background:var(--sc-card);transition:all .15s;margin-bottom:4px}
.clean-task.done{background:var(--sc-green-bg);border-color:#A7F3D0;opacity:.7}
.clean-task.overdue{background:var(--sc-red-bg);border-color:#FECACA;border-left:3px solid var(--sc-red)}
.clean-check{width:18px;height:18px;border-radius:4px;border:2px solid var(--sc-border);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.clean-check.checked{background:var(--sc-green);border-color:var(--sc-green);color:#fff}

.notif-item{display:flex;gap:10px;padding:10px 14px;border-radius:8px;background:var(--sc-subtle);border:1px solid var(--sc-border);margin-bottom:4px;cursor:pointer;transition:background .1s}
.notif-item:hover{background:var(--sc-accent-bg2)}.notif-item.unread{background:var(--sc-accent-bg);border-color:#BFDBFE}

.open-shift-card{background:#FFF7ED;border:2px solid #F97316;border-radius:10px;padding:12px;margin-bottom:8px;animation:pulse-or 2s infinite}
@keyframes pulse-or{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,.3)}50%{box-shadow:0 0 0 6px rgba(249,115,22,.0)}}
.pensum-bar{background:var(--sc-border-2);border-radius:999px;height:4px;margin-top:4px}
.pensum-fill{height:100%;border-radius:999px;background:var(--sc-accent);transition:width .3s}
.frst-badge{padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700}
.email-dlg{background:var(--sc-card);border-radius:14px;padding:22px;max-width:360px;width:90%;box-shadow:var(--sc-shadow-lg);color:var(--sc-text)}
.email-client-btn{width:100%;padding:11px 14px;border-radius:8px;border:1px solid var(--sc-border);background:var(--sc-subtle);cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:10px;margin-bottom:8px;transition:all .15s;color:var(--sc-text)}
.email-client-btn:hover{background:var(--sc-accent-bg);border-color:var(--sc-accent)}

.no-emoji .emo{display:none}
.theme-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:9px;border:2px solid var(--sc-border);background:var(--sc-card);cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:all .15s;color:var(--sc-text)}
.theme-pill:hover{border-color:var(--sc-accent)}
.theme-pill.active{border-color:var(--sc-accent);background:var(--sc-accent-bg);color:var(--sc-accent)}

@media(max-width:900px){.sc-grid2{grid-template-columns:1fr}.sc-grid3{grid-template-columns:1fr 1fr}}
@media(max-width:640px){
  .sc-main{padding:12px 8px}
  .sc-card{padding:12px;border-radius:10px}
  .sc-hdr{height:48px;padding:0 10px}
  .sc-h2{font-size:14px}
  .sc-btn{min-height:36px;font-size:12px;padding:6px 12px}
  .sc-input,.sc-sel{min-height:38px;font-size:14px;padding:8px 10px}
  .lbl{font-size:12px}
  .tbl-wrap{border-radius:6px;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;position:relative}
  .tbl-wrap::after{content:'';position:sticky;right:0;top:0;bottom:0;width:24px;background:linear-gradient(90deg,transparent,rgba(0,0,0,.06));pointer-events:none;z-index:4}
  .sc-tbl th{min-width:38px;font-size:11px;padding:6px 2px}
  .sc-tbl td{padding:2px;font-size:11px}
  .sc-tbl .name-cell{min-width:90px;max-width:90px;font-size:11px;padding:6px 6px}
  .shift-blk{border-radius:5px;font-size:11px !important;padding:4px 4px !important;min-height:30px}
  .dlg{padding:20px 16px;width:96%;border-radius:12px}
  .login-card{padding:28px 20px;border-radius:14px}
  .notif-item{padding:10px 8px}
  .sc-grid2{gap:10px}
  .al{font-size:12px;padding:8px 10px}
  .prog{height:6px}
  .g2{grid-template-columns:1fr !important}
  .g3{grid-template-columns:1fr 1fr !important}
}
@media print{.sc-hdr{display:none}.sc-main{padding:0}@page{size:A4 landscape;margin:8mm}}
`;

// ─────────────────────────────────────────────────────────────────
// DIALOGS
// ─────────────────────────────────────────────────────────────────

function ConfirmDialog({title,message,onConfirm,onCancel,confirmLabel="Ja",confirmClass="sc-btn-r"}){
  return(
    <div className="dlg-overlay" onClick={onCancel}>
      <div className="dlg" onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>{title}</div>
        <div style={{fontSize:13,color:"#64748B",lineHeight:1.6,marginBottom:22}} dangerouslySetInnerHTML={{__html:message}}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button className="sc-btn sc-btn-s" onClick={onCancel}>Abbrechen</button>
          <button className={`sc-btn ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function EmailDialog({to,subject,body,onClose}){
  return(
    <div className="dlg-overlay" onClick={onClose}>
      <div className="email-dlg" onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>📧 E-Mail senden</div>
        <div style={{fontSize:11,color:"#64748B",marginBottom:16,wordBreak:"break-all"}}>An: {to}</div>
        <button className="email-client-btn" onClick={()=>{openEmail("gmail",to,subject,body);onClose();}}>
          <span style={{fontSize:18}}>✉️</span> Gmail (Browser)
        </button>
        <button className="email-client-btn" onClick={()=>{openEmail("outlook",to,subject,body);onClose();}}>
          <span style={{fontSize:18}}>📮</span> Outlook (Browser)
        </button>
        <button className="email-client-btn" onClick={()=>{openEmail("default",to,subject,body);onClose();}}>
          <span style={{fontSize:18}}>💌</span> Standard-Mail-App
        </button>
        <button className="sc-btn sc-btn-s" style={{width:"100%",marginTop:4}} onClick={onClose}>Abbrechen</button>
      </div>
    </div>
  );
}

function EmpPasswordSetter({empId,passwords,setPasswords}){
  const [pw,setPw]=useState("");
  const [saved,setSaved]=useState(false);
  const save=()=>{
    if(!pw.trim()) return;
    setPasswords(p=>({...p,[empId]:btoa(pw)}));
    setSaved(true);setPw("");
    setTimeout(()=>setSaved(false),2000);
  };
  return(
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <input className="sc-input" type="password" placeholder="Neues Passwort" value={pw} style={{flex:1}}
        onChange={e=>{setPw(e.target.value);setSaved(false);}}
        onKeyDown={e=>e.key==="Enter"&&save()}/>
      <button className="sc-btn sc-btn-g" style={{fontSize:11,padding:"5px 10px",flexShrink:0}} onClick={save} disabled={!pw.trim()}>✓ Setzen</button>
      {saved&&<span style={{fontSize:10,color:"#059669",flexShrink:0}}>✓ Gespeichert</span>}
    </div>
  );
}

function ShiftPopup({popup,employees,onReassign,onDelete,onClose}){
  const ref=useRef(null);
  const [style,setStyle]=useState({top:popup.y+8,left:popup.x});
  useEffect(()=>{
    if(!ref.current) return;
    const r=ref.current.getBoundingClientRect();
    let left=popup.x,top=popup.y+8;
    if(left+r.width>window.innerWidth-8) left=window.innerWidth-r.width-8;
    if(top+r.height>window.innerHeight-8) top=popup.y-r.height-8;
    if(left<8) left=8;
    setStyle({top,left});
  },[popup]);
  return(
    <>
      <div className="popup-overlay" onClick={onClose}/>
      <div className="shift-popup" ref={ref} style={style}>
        <div className="shift-popup-hdr">✏️ Schicht zuweisen</div>
        {employees.map(emp=>(
          <button key={emp.id} className={`shift-popup-emp${emp.id===popup.currentEmpId?" current":""}`} onClick={()=>onReassign(emp.id)}>
            <span style={{width:10,height:10,borderRadius:"50%",background:emp.color,display:"inline-block",flexShrink:0}}/>
            <span style={{flex:1}}>{emp.name}</span>
            <span style={{fontSize:10,color:"#94A3B8"}}>{emp.pensumPct}%</span>
            {emp.id===popup.currentEmpId&&<span style={{color:"#0EA5E9",fontSize:10}}>✓</span>}
          </button>
        ))}
        <div style={{borderTop:"1px solid #F1F5F9"}}/>
        <button className="shift-popup-del" onClick={onDelete}>🗑️ Schicht löschen</button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// NAV HEADER with dropdown
// ─────────────────────────────────────────────────────────────────

function NavHeader({tab,setTab,prevTab,setPrevTab,TABS,isAdmin,myEmp,planMonth,setPlanMonth,planYear,setPlanYear,
  unreadCount,pendingEmails,setPendingEmails,showPendingEmails,setShowPendingEmails,
  syncStatus,ionosCfg,onLogout,emergencyContacts,teamEmployees,appSettings}) {
  const [open,setOpen]=useState(false);
  const menuRef=useRef(null);
  const E=s=>appSettings?.showEmojis!==false?s:"";

  useEffect(()=>{
    const handler=(e)=>{ if(menuRef.current&&!menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",handler);
    return ()=>document.removeEventListener("mousedown",handler);
  },[]);

  const visibleTabs=TABS.filter(t=>t.id!=="notifications");
  const adminTabs=visibleTabs.filter(t=>t.adminOnly);
  const sharedTabs=visibleTabs.filter(t=>!t.adminOnly);
  const isColorful=appSettings?.theme==="colorful";
  const ic=isColorful?"#fff":"var(--sc-text)";
  const ic2=isColorful?"rgba(255,255,255,.6)":"var(--sc-text-3)";
  const btnBg=isColorful?"rgba(255,255,255,.1)":"var(--sc-subtle)";
  const btnBd=isColorful?"1px solid rgba(255,255,255,.25)":"1px solid var(--sc-border)";

  return(
    <header style={{background:"var(--sc-hdr)",borderBottom:isColorful?"none":"1px solid var(--sc-border)",padding:"0 10px",
      display:"flex",alignItems:"center",height:48,gap:6,position:"sticky",top:0,
      zIndex:200,boxShadow:"var(--sc-hdr-shadow)"}}>

      {/* Hamburger menu */}
      <div ref={menuRef} style={{position:"relative",flexShrink:0}}>
        <button onClick={()=>setOpen(o=>!o)}
          style={{width:36,height:36,borderRadius:8,border:btnBd,
            background:open?(isColorful?"rgba(255,255,255,.25)":"var(--sc-accent-bg)"):btnBg,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:18,color:open?(isColorful?"#fff":"var(--sc-accent)"):ic,transition:"all .15s",flexShrink:0}}>
          {open?"✕":"☰"}
        </button>

        {open&&(
          <>
            <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setOpen(false)}/>
            <div style={{position:"fixed",top:52,left:8,zIndex:9999,
              background:"var(--sc-card)",borderRadius:14,boxShadow:"var(--sc-shadow-lg)",
              border:"1px solid var(--sc-border)",width:"calc(100vw - 16px)",maxWidth:280,overflow:"hidden",
              animation:"dlg-in .12s ease"}}>

              {sharedTabs.length>0&&<>
                <div style={{padding:"10px 14px 4px",fontSize:10,fontWeight:700,color:"var(--sc-text-3)",
                  textTransform:"uppercase",letterSpacing:".05em"}}>
                  {isAdmin?"Alle":"Menü"}
                </div>
                {sharedTabs.map(t=>(
                  <button key={t.id} onClick={()=>{setTab(t.id);setOpen(false);}}
                    style={{width:"100%",padding:"12px 16px",border:"none",textAlign:"left",
                      background:tab===t.id?"var(--sc-accent-bg)":"transparent",cursor:"pointer",
                      fontFamily:"inherit",fontSize:14,fontWeight:tab===t.id?700:400,
                      color:tab===t.id?"var(--sc-accent)":"var(--sc-text)",display:"flex",alignItems:"center",gap:10}}>
                    {E(t.icon)&&<span style={{fontSize:17,width:24,textAlign:"center"}}>{t.icon}</span>}
                    <span style={{flex:1}}>{t.label}</span>
                    {tab===t.id&&<span style={{fontSize:10,color:"var(--sc-accent)"}}>●</span>}
                  </button>
                ))}
              </>}

              {isAdmin&&adminTabs.length>0&&<>
                <div style={{borderTop:"1px solid var(--sc-border-2)",padding:"10px 14px 4px",fontSize:10,
                  fontWeight:700,color:"var(--sc-text-3)",textTransform:"uppercase",letterSpacing:".05em"}}>Admin</div>
                {adminTabs.map(t=>(
                  <button key={t.id} onClick={()=>{setTab(t.id);setOpen(false);}}
                    style={{width:"100%",padding:"12px 16px",border:"none",textAlign:"left",
                      background:tab===t.id?"var(--sc-accent-bg)":"transparent",cursor:"pointer",
                      fontFamily:"inherit",fontSize:14,fontWeight:tab===t.id?700:400,
                      color:tab===t.id?"var(--sc-accent)":"var(--sc-text)",display:"flex",alignItems:"center",gap:10}}>
                    {E(t.icon)&&<span style={{fontSize:17,width:24,textAlign:"center"}}>{t.icon}</span>}
                    <span style={{flex:1}}>{t.label}</span>
                    {tab===t.id&&<span style={{fontSize:10,color:"var(--sc-accent)"}}>●</span>}
                  </button>
                ))}
              </>}

              {/* Divider + user info + logout */}
              <div style={{borderTop:"1px solid var(--sc-border-2)",padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                  background:isAdmin?"var(--sc-purple-bg)":"var(--sc-green-bg)",color:isAdmin?"var(--sc-purple)":"var(--sc-green)",whiteSpace:"nowrap"}}>
                  {isAdmin?`${E("🛡️")} Admin`:`${E("👤")} ${myEmp?.name||"MA"}`}
                </span>
                <button onClick={()=>{setOpen(false);onLogout();}}
                  style={{marginLeft:"auto",padding:"6px 14px",borderRadius:8,border:"1px solid #FECACA",
                    background:"var(--sc-red-bg)",cursor:"pointer",fontSize:12,fontWeight:600,
                    color:"var(--sc-red)",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                  {E("🚪")} Abmelden
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Month picker - always visible */}
      <div style={{display:"flex",alignItems:"center",gap:2,flex:1,justifyContent:"center",minWidth:0}}>
        <button onClick={()=>{if(planMonth===1){setPlanMonth(12);setPlanYear(planYear-1);}else setPlanMonth(planMonth-1);}}
          style={{width:26,height:26,borderRadius:6,border:btnBd,background:btnBg,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,color:ic2,flexShrink:0}}>◀</button>
        <span style={{fontSize:12,fontWeight:600,color:ic,padding:"0 4px",whiteSpace:"nowrap",userSelect:"none"}}>
          {MONTHS_DE[planMonth-1].slice(0,3)} {String(planYear).slice(2)}
        </span>
        <button onClick={()=>{if(planMonth===12){setPlanMonth(1);setPlanYear(planYear+1);}else setPlanMonth(planMonth+1);}}
          style={{width:26,height:26,borderRadius:6,border:btnBd,background:btnBg,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:11,color:ic2,flexShrink:0}}>▶</button>
      </div>

      {/* Right: notifications only */}
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        {isAdmin&&pendingEmails.length>0&&(
          <button onClick={e=>{e.stopPropagation();setShowPendingEmails(p=>!p);}}
            style={{position:"relative",background:"var(--sc-warn-bg)",border:"1px solid #FDE68A",
              borderRadius:8,cursor:"pointer",fontSize:10,fontWeight:700,padding:"4px 8px",color:"#92400E"}}>
            {E("📧")}{pendingEmails.length}
          </button>
        )}
        <button onClick={()=>{if(tab==="notifications"){setTab(prevTab||"plan");}else{setPrevTab(tab);setTab("notifications");}}}
          style={{position:"relative",width:36,height:36,borderRadius:10,
            border:tab==="notifications"?"2px solid var(--sc-accent)":(unreadCount>0?"2px solid var(--sc-red)":"1px solid var(--sc-border)"),
            background:tab==="notifications"?(isColorful?"rgba(255,255,255,.25)":"var(--sc-accent-bg)"):(unreadCount>0?(isColorful?"rgba(239,68,68,.2)":"var(--sc-red-bg)"):"transparent"),
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,
            transition:"all .2s",animation:unreadCount>0&&tab!=="notifications"?"bell-pulse 2s infinite":"none"}}>
          {tab==="notifications"?"✕":(E("💬")||<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>)}
          {unreadCount>0&&tab!=="notifications"&&<span style={{position:"absolute",top:-2,right:-2,background:"var(--sc-red)",
            color:"#fff",borderRadius:"999px",fontSize:8,fontWeight:700,
            minWidth:16,height:16,display:"inline-flex",alignItems:"center",
            justifyContent:"center",padding:"0 3px",border:"2px solid var(--sc-card)"}}>{unreadCount}</span>}
        </button>
      </div>
    </header>
  );
}

export default function ShiftCare() {
  const now=new Date();
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("setup");
  const [prevTab,setPrevTab]=useState("plan");
  const [planMonth,setPlanMonth]=useState(now.getMonth()+1);
  const [planYear,setPlanYear]=useState(now.getFullYear());

  const [employees,setEmployees]=useState(INIT_EMP);
  const [care,setCare]=useState(INIT_CARE);
  const [schedule,setSchedule]=useState({});
  const [surcharges,setSurcharges]=useState(INIT_SC);
  const [limits,setLimits]=useState(INIT_LIMITS);
  const [adminEmail,setAdminEmail]=useState("");
  const [genLoading,setGenLoading]=useState(false);
  const [genError,setGenError]=useState(null);
  const [genWarns,setGenWarns]=useState([]);
  const [expandedEmp,setExpandedEmp]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null);
  const [shiftPopup,setShiftPopup]=useState(null);
  const [emailDlg,setEmailDlg]=useState(null);
  const [onboardingStep,setOnboardingStep]=useState(null); // null=done, 1-4=wizard steps

  const [empPrefs,setEmpPrefs]=useState({});
  const [empConstraints,setEmpConstraints]=useState({}); // can/cannot dates (hard)
  const [carePrefs,setCarePrefs]=useState({});
  const [vacReqs,setVacReqs]=useState({});
  const [sickReqs,setSickReqs]=useState({});
  const [adminAbsence,setAdminAbsence]=useState({});
  const [freistellung,setFreistellung]=useState({});
  const [cleaningTasks,setCleaningTasks]=useState({});
  const [cleaningLog,setCleaningLog]=useState({});
  const [howtoItems,setHowtoItems]=useState([]);
  const [notifications,setNotifications]=useState([]);
  const [payrollConf,setPayrollConf]=useState({});
  const [scheduleFilters,setScheduleFilters]=useState({showAllColleagues:true,showOwnVacation:true,showWishes:true});
  const [planPrefs,setPlanPrefs]=useState({}); // { [careId]: { preferredBlockSize, note } }
  const [shiftTakeovers,setShiftTakeovers]=useState([]); // [{id, careId, shiftIdx, originalEmpId, newEmpId, date, confirmedAt}]
  const [appSettings,setAppSettings]=useState({theme:"light",showEmojis:true});
  const [emergencyContacts,setEmergencyContacts]=useState(INIT_EMERGENCY_CONTACTS);
  const [shiftPatterns,setShiftPatterns]=useState(INIT_SHIFT_PATTERNS);
  const [pendingTakeovers,setPendingTakeovers]=useState([]);
  const [payrollOverrides,setPayrollOverrides]=useState({}); // {[empId_moStr]: {field, oldVal, newVal, reason, ts}[]}
  const [swapRequests,setSwapRequests]=useState([]);
  const [shiftAdjustments,setShiftAdjustments]=useState([]); // [{id,empId,careId,shiftIdx,date,type,actualMinutes,note,status}]
  const [holidayStats,setHolidayStats]=useState({});
  const [planConfirmations,setPlanConfirmations]=useState({}); // {[empId_moStr]: {ts, planVersion}}
  const [planVersions,setPlanVersions]=useState({}); // {[moStr]: timestamp of last schedule change}
  const [auditLog,setAuditLog]=useState([]); // [{id,ts,userId,userName,role,action,details,moStr}]

  const [syncStatus,setSyncStatus]=useState("local"); // "local"|"syncing"|"synced"|"error"
  const [ionosCfg,setIonosCfg]=useState(()=>{try{const c=localStorage.getItem("sc_ionos");return c?JSON.parse(c):null;}catch{return null;}});
  const [backendCfg,setBackendCfg]=useState(()=>{try{const c=localStorage.getItem("sc_backend");return c?JSON.parse(c):{url:"",enabled:false};}catch{return{url:"",enabled:false};}});
  const [lodasLohnarten,setLodasLohnarten]=useState(DEFAULT_LODAS_LOHNARTEN);
  const [betriebsNr,setBetriebsNr]=useState("");
  const [pendingEmails,setPendingEmails]=useState([]); // [{to,subject,body,label}]
  const [showPendingEmails,setShowPendingEmails]=useState(false);
  const [passwords,setPasswords]=useState(()=>{try{const p=localStorage.getItem("sc_passwords");return p?JSON.parse(p):{admin:btoa("admin123")};}catch{return{admin:btoa("admin123")};}});
  const [loginForm,setLoginForm]=useState({email:"",password:"",error:""});
  const [dsgvoConsent,setDsgvoConsent]=useState(()=>{try{return localStorage.getItem("sc_dsgvo")==="yes";}catch{return false;}});

  const addPendingEmail=useCallback((to,subject,body,label)=>{
    setPendingEmails(prev=>[...prev,{id:Date.now()+"_"+Math.random(),to,subject,body,label:label||subject}]);
  },[]);

  const applyData=(d)=>{
    if(d.employees)      setEmployees(d.employees);
    if(d.care)           setCare(d.care);
    if(d.schedule)       setSchedule(d.schedule);
    if(d.surcharges)     setSurcharges(d.surcharges);
    if(d.limits)         setLimits(d.limits);
    if(d.adminEmail)     setAdminEmail(d.adminEmail);
    if(d.empPrefs)       setEmpPrefs(d.empPrefs);
    if(d.empConstraints) setEmpConstraints(d.empConstraints);
    if(d.carePrefs)      setCarePrefs(d.carePrefs);
    if(d.vacReqs)        setVacReqs(d.vacReqs);
    if(d.sickReqs)       setSickReqs(d.sickReqs);
    if(d.adminAbsence)   setAdminAbsence(d.adminAbsence);
    if(d.freistellung)   setFreistellung(d.freistellung);
    if(d.cleaningTasks)  setCleaningTasks(d.cleaningTasks);
    if(d.cleaningLog)    setCleaningLog(d.cleaningLog);
    if(d.howtoItems)     setHowtoItems(d.howtoItems);
    if(d.notifications)  setNotifications(d.notifications);
    if(d.payrollConf)    setPayrollConf(d.payrollConf);
    if(d.planPrefs)      setPlanPrefs(d.planPrefs);
    if(d.shiftTakeovers) setShiftTakeovers(d.shiftTakeovers);
    if(d.appSettings)    setAppSettings(p=>({...p,...d.appSettings}));
    if(d.emergencyContacts) setEmergencyContacts(d.emergencyContacts);
    if(d.shiftPatterns)  setShiftPatterns(d.shiftPatterns);
    if(d.pendingTakeovers) setPendingTakeovers(d.pendingTakeovers);
    if(d.payrollOverrides) setPayrollOverrides(d.payrollOverrides);
    if(d.swapRequests)   setSwapRequests(d.swapRequests);
    if(d.shiftAdjustments) setShiftAdjustments(d.shiftAdjustments);
    if(d.planConfirmations) setPlanConfirmations(d.planConfirmations);
    if(d.planVersions) setPlanVersions(d.planVersions);
    if(d.auditLog) setAuditLog(d.auditLog);
    if(d.holidayStats)   setHolidayStats(d.holidayStats);
    if(d.lodasLohnarten) setLodasLohnarten(p=>({...p,...d.lodasLohnarten}));
    if(d.betriebsNr)     setBetriebsNr(d.betriebsNr);
  };

  // Load on mount: Backend API → IONOS → Firebase → localStorage
  useEffect(()=>{
    (async()=>{
      // localStorage instant load (always, as baseline)
      try{
        const saved=localStorage.getItem("shiftcare_v61");
        if(saved) applyData(deserializeState(saved));
      }catch(e){}
      // Backend API (Phase 2 – preferred if configured)
      if(BackendAPI.restoreSession()&&BackendAPI._url){
        const state=await BackendAPI.loadState();
        if(state?.data&&Object.keys(state.data).length>0){applyData(state.data);return;}
      }
      // IONOS (preferred cloud, EU DSGVO)
      const cfg=(() => { try{ const c=localStorage.getItem("sc_ionos"); return c?JSON.parse(c):null; }catch{ return null; } })();
      if(cfg?.bucket&&cfg?.accessKey&&cfg?.secretKey){
        setSyncStatus("syncing");
        const d=await loadFromIONOS(cfg);
        if(d){ applyData(d); setSyncStatus("synced"); return; }
        setSyncStatus("error");
      }
      // Firebase fallback
      if(FIREBASE_CONFIG){
        setSyncStatus("syncing");
        const ok=await initFirebase();
        if(ok){
          const fbData=await loadFromFirebase();
          if(fbData){ applyData(fbData); setSyncStatus("synced"); }
          else setSyncStatus("synced");
        } else setSyncStatus("error");
      }
    })();
  },[]);// eslint-disable-line

  useEffect(()=>{
    if(!user) return;
    // Auto-archive: trim old data to manage localStorage size
    const trimmedNotif=notifications.slice(0,80);
    const trimmedAudit=(auditLog||[]).slice(0,400);
    const curYear=planYear;
    const trimmedAdj=(shiftAdjustments||[]).filter(r=>{const y=r.date?.split("-")[0];return !y||Number(y)>=curYear-1;});
    const s={employees,care,schedule,surcharges,limits,adminEmail,empPrefs,empConstraints,carePrefs,
      vacReqs,sickReqs,adminAbsence,freistellung,cleaningTasks,cleaningLog,howtoItems,notifications:trimmedNotif,payrollConf,
      planPrefs,shiftTakeovers,appSettings,emergencyContacts,shiftPatterns,pendingTakeovers,
      payrollOverrides,swapRequests,shiftAdjustments:trimmedAdj,holidayStats,planConfirmations,planVersions,auditLog:trimmedAudit,lodasLohnarten,betriebsNr};
    // localStorage (instant)
    try{ localStorage.setItem("shiftcare_v61",serializeState(s)); }catch(e){}
    // Backend API sync (Phase 2)
    if(backendCfg?.enabled&&backendCfg?.url&&BackendAPI._token){
      BackendAPI.configure(backendCfg.url);
      BackendAPI.saveState(s).catch(()=>{});
    }
    // IONOS S3 (EU-Cloud, DSGVO-konform)
    if(ionosCfg?.bucket&&ionosCfg?.accessKey&&ionosCfg?.secretKey){
      setSyncStatus("syncing");
      saveToIONOS(s,ionosCfg).then(ok=>setSyncStatus(ok?"synced":"error"));
    } else if(FIREBASE_CONFIG){
      setSyncStatus("syncing");
      saveToFirebase(s).then(ok=>setSyncStatus(ok?"synced":"error"));
    }
  },[employees,care,schedule,surcharges,limits,adminEmail,empPrefs,empConstraints,carePrefs,
     vacReqs,sickReqs,adminAbsence,freistellung,cleaningTasks,cleaningLog,howtoItems,notifications,payrollConf,
     planPrefs,shiftTakeovers,appSettings,emergencyContacts,shiftPatterns,pendingTakeovers,
     payrollOverrides,swapRequests,shiftAdjustments,holidayStats,planConfirmations,planVersions,auditLog,lodasLohnarten,betriebsNr,user]);

  useEffect(()=>{try{localStorage.setItem("sc_passwords",JSON.stringify(passwords));}catch{}}, [passwords]);

  useEffect(()=>{
    const id="sc61-css";
    if(!document.getElementById(id)){const s=document.createElement("style");s.id=id;s.textContent=CSS;document.head.appendChild(s);}
  },[]);

  useEffect(()=>{
    const t=THEMES[appSettings.theme]||THEMES.light;
    Object.entries(t).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    if(appSettings.showEmojis) document.body.classList.remove("no-emoji");
    else document.body.classList.add("no-emoji");
  },[appSettings.theme,appSettings.showEmojis]);

  // Derived
  const numDays=useMemo(()=>daysInMonth(planYear,planMonth),[planYear,planMonth]);
  const isAdmin=user?.role==="admin";
  const myEmp=user?.role==="employee"?employees.find(e=>e.id===user.empId):null;
  const unreadCount=useMemo(()=>notifications.filter(n=>!n.read).length,[notifications]);

  const activeEmployees=useMemo(()=>{
    const freiSet=new Set();
    employees.forEach(emp=>(freistellung[emp.id]||[]).forEach(f=>{
      const s=new Date(f.startDate),e=f.endDate?new Date(f.endDate):new Date(9999,0,1);
      const ms=new Date(planYear,planMonth-1,1),me=new Date(planYear,planMonth,0);
      if(s<=me&&e>=ms) freiSet.add(emp.id);
    }));
    return employees.filter(e=>!freiSet.has(e.id));
  },[employees,freistellung,planYear,planMonth]);

  // Holiday map per care Bundesland
  const holidayMaps=useMemo(()=>{
    const m={};
    care.forEach(c=>{ m[c.id]=getHolidaysByBL(planYear,c.bundesland||"BW"); });
    return m;
  },[care,planYear]);
  // Global holiday map (first care's BL or BW) for tabs that don't care about which employer
  const defaultHolidayMap=useMemo(()=>holidayMaps[care[0]?.id]||getHolidaysByBL(planYear,"BW"),[holidayMaps,care,planYear]);
  const defaultHolidaySet=useMemo(()=>new Set(Object.keys(defaultHolidayMap)),[defaultHolidayMap]);

  const empHours=useMemo(()=>{
    const h={};employees.forEach(e=>h[e.id]=0);
    const moStr=`${planYear}-${fmt2(planMonth)}`;
    Object.values(schedule).forEach(shifts=>(shifts||[]).forEach(s=>{
      if(h[s.employeeId]!==undefined&&s.startDate?.startsWith(moStr)) h[s.employeeId]+=s.durationH;
    }));
    return h;
  },[schedule,employees,planYear,planMonth]);

  useEffect(()=>{
    if(!Object.keys(schedule).length) return;
    const hMap=getHolidaysByBL(planYear,care[0]?.bundesland||"BW");
    const newStats={};
    employees.forEach(e=>{newStats[e.id]={hol:0,sun:0,holDates:[],sunDates:[]};});
    // Scan all 12 months of planYear
    for(let mo=1;mo<=12;mo++){
      const nd=daysInMonth(planYear,mo);
      for(let d=1;d<=nd;d++){
        const dt=fmtDate(planYear,mo,d);
        const dow=new Date(planYear,mo-1,d).getDay();
        const isHol=!!hMap[dt],isSun=dow===0;
        if(!isHol&&!isSun) continue;
        // Find employee with majority hours on this day
        const hoursOnDay={};
        Object.entries(schedule).forEach(([cId,shifts])=>{
          (shifts||[]).forEach(s=>{
            if(!s.employeeId) return;
            const[sy,sm,sd]=s.startDate.split("-").map(Number);
            if(sy!==planYear) return;
            const shiftStart=fmtDate(sy,sm,sd);
            const durationDays=Math.ceil(s.durationH/24);
            for(let i=0;i<durationDays;i++){
              const dd=new Date(sy,sm-1,sd+i);
              if(fmtDate(dd.getFullYear(),dd.getMonth()+1,dd.getDate())===dt){
                const dayH=Math.min(s.durationH-i*24,24);
                hoursOnDay[s.employeeId]=(hoursOnDay[s.employeeId]||0)+dayH;
              }
            }
          });
        });
        if(!Object.keys(hoursOnDay).length) continue;
        const majorityEmp=Object.entries(hoursOnDay).reduce((a,b)=>b[1]>a[1]?b:a,[null,0]);
        if(majorityEmp[0]&&newStats[majorityEmp[0]]){
          if(isHol){newStats[majorityEmp[0]].hol++;newStats[majorityEmp[0]].holDates.push(dt);}
          else if(isSun){newStats[majorityEmp[0]].sun++;newStats[majorityEmp[0]].sunDates.push(dt);}
        }
      }
    }
    setHolidayStats(newStats);
  },[schedule,planYear,employees,care]);

  const getMaxH=useCallback(emp=>emp.customMaxH??Math.round((emp.pensumPct??100)/100*160),[]);
  const getEmpP=useCallback((eId,y,m)=>empPrefs[eId]?.[y]?.[m]||{wishOff:new Set(),wishWork:new Set()},[empPrefs]);
  const getEmpC=useCallback((eId,y,m)=>empConstraints[eId]?.[y]?.[m]||{cannotDates:new Set(),canDates:new Set()},[empConstraints]);

  const toggleEmpP=useCallback((eId,date,mode,y,m)=>{
    setEmpPrefs(prev=>{
      const yr=prev[eId]?.[y]||{};
      const mo=yr[m]||{wishOff:new Set(),wishWork:new Set()};
      const n={wishOff:new Set(mo.wishOff),wishWork:new Set(mo.wishWork)};
      if(mode==="wishOff") n.wishWork.delete(date);
      if(mode==="wishWork") n.wishOff.delete(date);
      n[mode].has(date)?n[mode].delete(date):n[mode].add(date);
      return{...prev,[eId]:{...prev[eId],[y]:{...yr,[m]:n}}};
    });
  },[]);

  const toggleEmpC=useCallback((eId,date,mode,y,m)=>{
    setEmpConstraints(prev=>{
      const yr=prev[eId]?.[y]||{};
      const mo=yr[m]||{cannotDates:new Set(),canDates:new Set()};
      const n={cannotDates:new Set(mo.cannotDates),canDates:new Set(mo.canDates)};
      if(mode==="cannotDates") n.canDates.delete(date);
      if(mode==="canDates") n.cannotDates.delete(date);
      n[mode].has(date)?n[mode].delete(date):n[mode].add(date);
      return{...prev,[eId]:{...prev[eId],[y]:{...yr,[m]:n}}};
    });
  },[]);

  const getApprovedVacDates=useCallback((eId,year)=>
    new Set((vacReqs[eId]?.[year]||[]).filter(r=>r.status==="approved").flatMap(r=>r.adminDates||r.dates))
  ,[vacReqs]);

  const getSickDates=useCallback((eId,year)=>
    new Set((sickReqs[eId]?.[year]||[]).filter(r=>r.status==="confirmed").flatMap(r=>r.dates))
  ,[sickReqs]);

  const getVacUsed=useCallback((eId,year)=>
    (vacReqs[eId]?.[year]||[]).filter(r=>r.status==="approved").reduce((a,r)=>a+(r.adminDates||r.dates).length,0)
  ,[vacReqs]);

  const addNotification=useCallback((type,message,empIds=[])=>{
    const n={id:Date.now()+"_"+Math.random(),type,message,read:false,date:today(),empIds};
    setNotifications(prev=>[n,...prev].slice(0,100));
  },[]);

  const addAudit=useCallback((action,details,moStr2)=>{
    const entry={id:Date.now()+"_"+Math.random().toString(36).slice(2,6),ts:new Date().toISOString(),
      userId:user?.role==="admin"?"admin":user?.empId||"system",
      userName:user?.role==="admin"?"Admin":employees.find(e=>e.id===user?.empId)?.name||"System",
      role:user?.role||"system",action,details,moStr:moStr2||`${planYear}-${fmt2(planMonth)}`};
    setAuditLog(prev=>[entry,...prev].slice(0,500));
  },[user,employees,planYear,planMonth]);

  // Track schedule version per month – invalidate confirmations on change
  useEffect(()=>{
    if(!Object.keys(schedule).length) return;
    const ms=`${planYear}-${fmt2(planMonth)}`;
    const now2=new Date().toISOString();
    setPlanVersions(prev=>{
      if(prev[ms]===undefined) return{...prev,[ms]:now2};
      return{...prev,[ms]:now2};
    });
  },[schedule,planYear,planMonth]);

  // Vacation
  const submitVac=useCallback((eId,year,dates)=>{
    const overlapping=employees.filter(other=>{
      if(other.id===eId) return false;
      const od=(vacReqs[other.id]?.[year]||[]).filter(r=>r.status!=="rejected").flatMap(r=>r.adminDates||r.dates);
      return dates.some(d=>od.includes(d));
    });
    setVacReqs(prev=>{
      const yr=prev[eId]?.[year]||[];
      return{...prev,[eId]:{...prev[eId],[year]:[...yr,{id:Date.now(),dates,adminDates:null,adminComment:"",status:"pending"}]}};
    });
    const emp=employees.find(e=>e.id===eId);
    addNotification("vacation_overlap",`📬 Urlaubsantrag von ${emp?.name}: ${dates.length} Tag(e)${overlapping.length>0?` · ⚠️ Überschneidung: ${overlapping.map(o=>o.name).join(", ")}`:""}`,
      [eId]);
    if(overlapping.length>0&&adminEmail){
      const subject=`ShiftCare: Urlaubs-Überschneidung – ${emp?.name}`;
      const body=`${emp?.name} hat Urlaub beantragt:\n${dates.join(", ")}\n\nÜberschneidung mit: ${overlapping.map(o=>o.name).join(", ")}\n\nBitte in ShiftCare entscheiden.`;
      addPendingEmail(adminEmail,subject,body,`Urlaubs-Überschneidung: ${emp?.name}`);
    }
  },[employees,vacReqs,adminEmail,addNotification,addPendingEmail]);

  const updateVac=useCallback((eId,year,reqId,status,adminDates,adminComment)=>{
    setVacReqs(prev=>{
      const yr=(prev[eId]?.[year]||[]).map(r=>r.id===reqId?{...r,status,adminDates:adminDates||null,adminComment:adminComment||""}:r);
      return{...prev,[eId]:{...prev[eId],[year]:yr}};
    });
    const emp=employees.find(e=>e.id===eId);
    addNotification("vacation_decided",`Urlaubsantrag von ${emp?.name} ${status==="approved"?"✅ genehmigt":"❌ abgelehnt"}`,[eId]);
    if(emp?.email){
      const subject=`ShiftCare: Urlaubsantrag ${status==="approved"?"genehmigt":"abgelehnt"}`;
      const body=`Hallo ${emp.name},\n\ndein Urlaubsantrag wurde ${status==="approved"?"genehmigt ✅":"abgelehnt ❌"}.${adminComment?`\n\nKommentar: ${adminComment}`:""}\n\nBei Fragen melde dich beim Arbeitgeber.`;
      addPendingEmail(emp.email,subject,body,`Urlaub ${status==="approved"?"genehmigt":"abgelehnt"}: ${emp.name}`);
    }
  },[employees,addNotification,addPendingEmail]);

  // Sick
  const submitSick=useCallback((eId,year,dates,note)=>{
    setSickReqs(prev=>{
      const yr=prev[eId]?.[year]||[];
      return{...prev,[eId]:{...prev[eId],[year]:[...yr,{id:Date.now(),dates,status:"pending",note,adminNote:""}]}};
    });
    const emp=employees.find(e=>e.id===eId);
    addNotification("sick_submitted",`🤒 Krankmeldung: ${emp?.name} · ${dates.length} Tag(e)`,[eId]);
    if(adminEmail){
      const subject=`ShiftCare: Krankmeldung – ${emp?.name}`;
      const body=`${emp?.name} hat sich krank gemeldet.\nDatum: ${dates.join(", ")}\nHinweis: ${note||"–"}\n\nBitte in ShiftCare bestätigen.`;
      addPendingEmail(adminEmail,subject,body,`Krankmeldung: ${emp?.name}`);
    }
  },[employees,adminEmail,addNotification,addPendingEmail]);

  const confirmSick=useCallback((eId,year,reqId,adminNote)=>{
    // Bestätigen + betroffene Schichten als "offen" markieren
    let sickDates=[];
    setSickReqs(prev=>{
      const yr=(prev[eId]?.[year]||[]).map(r=>{if(r.id===reqId){sickDates=r.dates;return{...r,status:"confirmed",adminNote:adminNote||""};}return r;});
      return{...prev,[eId]:{...prev[eId],[year]:yr}};
    });
    // Schichten öffnen
    setSchedule(prev=>{
      const newSched={...prev};
      Object.keys(newSched).forEach(careId=>{
        newSched[careId]=(newSched[careId]||[]).map(s=>{
          if(s.employeeId===eId&&sickDates.includes(s.startDate)) return{...s,open:true,originalEmpId:eId};
          return s;
        });
      });
      return newSched;
    });
    const emp=employees.find(e=>e.id===eId);
    addNotification("shift_open",`⚡ Offene Schicht(en): ${emp?.name} krank · Einspringen möglich!`,[]);
    // Alle MA benachrichtigen (als gebündelte E-Mail)
    const teamTo=activeEmployees.filter(e=>e.id!==eId&&e.email).map(e=>e.email).join(", ");
    if(teamTo){
      const subject="ShiftCare: ⚡ Offene Schicht – Einspringen?";
      const body=`Liebes Team,\n\n${emp?.name} ist krank. Es gibt offene Schichten für die jemand einspringen kann.\n\nBitte im Aushang nachsehen und ggf. bestätigen.`;
      addPendingEmail(teamTo,subject,body,`Offene Schicht – Team benachrichtigen (${emp?.name} krank)`);
    }
  },[employees,activeEmployees,adminEmail,addNotification,addPendingEmail]);

  // Schichtübernahme
  const takeoverShift=useCallback((careId,shiftIdx,newEmpId)=>{
    const shift=schedule[careId]?.[shiftIdx];
    if(!shift) return;
    const originalEmpId=shift.originalEmpId||shift.employeeId;
    confirmTakeover(careId,shiftIdx,newEmpId,originalEmpId,shift);
  },[schedule]);

  const confirmTakeover=useCallback((careId,shiftIdx,newEmpId,originalEmpId,shift)=>{
    setSchedule(prev=>{
      const shifts=[...(prev[careId]||[])];
      shifts[shiftIdx]={...shifts[shiftIdx],employeeId:newEmpId,open:false,takenOver:true,takenOverBy:newEmpId,originalEmpId};
      return{...prev,[careId]:shifts};
    });
    setShiftTakeovers(prev=>[...prev,{
      id:Date.now()+"",careId:Number(careId),shiftIdx,originalEmpId,newEmpId,
      date:shift.startDate,durationH:shift.durationH,confirmedAt:new Date().toISOString()
    }]);
    setPendingTakeovers(prev=>prev.filter(p=>!(p.careId===Number(careId)&&p.shiftIdx===shiftIdx)));
    const newEmp=employees.find(e=>e.id===newEmpId);
    const origEmp=employees.find(e=>e.id===originalEmpId);
    addNotification("shift_taken",`🤝 ${newEmp?.name} übernimmt Schicht von ${origEmp?.name} am ${shift.startDate}`,[newEmpId,originalEmpId]);
  },[employees,addNotification]);

  // Schichttausch MA ↔ MA
  const requestSwap=useCallback((fromEmpId,toEmpId,careId,shiftIdx,date)=>{
    const cId=Number(careId);
    setSchedule(prev=>{
      const shifts=[...(prev[cId]||[])];
      if(shifts[shiftIdx]) shifts[shiftIdx]={...shifts[shiftIdx],employeeId:toEmpId};
      return{...prev,[cId]:shifts};
    });
    const req={id:Date.now()+"",fromEmpId,toEmpId,careId:cId,shiftIdx,date,status:"applied",requestedAt:new Date().toISOString()};
    setSwapRequests(prev=>[...prev,req]);
    const from=employees.find(e=>e.id===fromEmpId),to=employees.find(e=>e.id===toEmpId);
    addNotification("shift_changed",`🔄 Schichttausch: ${from?.name} → ${to?.name} am ${date}`,[fromEmpId,toEmpId]);
    setShiftAdjustments(prev=>[...prev,{id:Date.now()+"s",empId:fromEmpId,careId:cId,shiftIdx,date,type:"swap",note:`Tausch mit ${to?.name}`,status:"applied",requestedAt:new Date().toISOString()}]);
  },[employees,addNotification]);

  const confirmSwap=useCallback((reqId)=>{
    const req=swapRequests.find(r=>r.id===reqId);
    if(!req) return;
    setSchedule(prev=>{
      const shifts=[...(prev[req.careId]||[])];
      if(shifts[req.shiftIdx]) shifts[req.shiftIdx]={...shifts[req.shiftIdx],employeeId:req.toEmpId};
      return{...prev,[req.careId]:shifts};
    });
    setSwapRequests(prev=>prev.map(r=>r.id===reqId?{...r,status:"confirmed"}:r));
    const from=employees.find(e=>e.id===req.fromEmpId),to=employees.find(e=>e.id===req.toEmpId);
    addNotification("shift_taken",`✅ Tausch bestätigt: ${from?.name} ↔ ${to?.name} am ${req.date}`,[req.fromEmpId,req.toEmpId]);
  },[swapRequests,employees,addNotification]);

  const rejectSwap=useCallback((reqId)=>{
    setSwapRequests(prev=>prev.map(r=>r.id===reqId?{...r,status:"rejected"}:r));
  },[]);

  const requestShiftAdjust=useCallback((empId,careId,shiftIdx,date,type,actualMinutes,note)=>{
    const cId=Number(careId);
    const emp=employees.find(e=>e.id===empId);
    const oldShift=schedule[cId]?.[shiftIdx];
    const entry={id:Date.now()+"",empId,careId:cId,shiftIdx,date,type,actualMinutes,note,
      oldDurationH:oldShift?.durationH,status:"applied",requestedAt:new Date().toISOString()};
    const typeLabels={adjust:"Zeitkorrektur",giveaway:"Schichtabgabe",takeover:"Schichtübernahme",swap:"Schichttausch"};
    if(type==="adjust"){
      setSchedule(prev=>{
        const shifts=[...(prev[cId]||[])];
        if(shifts[shiftIdx]) shifts[shiftIdx]={...shifts[shiftIdx],durationH:Math.round(actualMinutes/60*100)/100,adjustedMinutes:actualMinutes};
        return{...prev,[cId]:shifts};
      });
      addNotification("shift_changed",`⏱️ Zeitkorrektur: ${emp?.name} am ${date} → ${Math.floor(actualMinutes/60)}h ${actualMinutes%60}min`,[empId]);
    } else if(type==="giveaway"){
      setSchedule(prev=>{
        const shifts=[...(prev[cId]||[])];
        if(shifts[shiftIdx]) shifts[shiftIdx]={...shifts[shiftIdx],open:true,originalEmpId:empId};
        return{...prev,[cId]:shifts};
      });
      addNotification("shift_changed",`📤 Schicht abgegeben: ${emp?.name} am ${date}`,[empId]);
    } else if(type==="takeover"){
      setSchedule(prev=>{
        const shifts=[...(prev[cId]||[])];
        if(shifts[shiftIdx]) shifts[shiftIdx]={...shifts[shiftIdx],employeeId:empId,open:false,takenOver:true,originalEmpId:oldShift?.employeeId||oldShift?.originalEmpId};
        return{...prev,[cId]:shifts};
      });
      const origEmp=employees.find(e=>e.id===(oldShift?.employeeId||oldShift?.originalEmpId));
      addNotification("shift_taken",`🤝 Schicht übernommen: ${emp?.name} am ${date} (von ${origEmp?.name||"offen"})`,[empId,origEmp?.id].filter(Boolean));
    }
    setShiftAdjustments(prev=>[...prev,entry]);
    addAudit(`shift_${type}`,`${typeLabels[type]||type}: ${emp?.name} am ${date}${type==="adjust"?` (${Math.floor(actualMinutes/60)}h${actualMinutes%60}min)`:""}${note?` – ${note}`:""}`);
  },[employees,schedule,addNotification,addAudit]);

  const reviewMonthChanges=useCallback((ms)=>{
    setShiftAdjustments(prev=>prev.map(r=>r.date?.startsWith(ms)&&r.status==="applied"?{...r,status:"reviewed"}:r));
    addAudit("changes_reviewed",`Alle Schichtänderungen für ${ms} geprüft und freigegeben`,ms);
  },[addAudit]);

  // Payroll Override (manuelle Anpassung mit Begründung + Undo)
  const applyPayrollOverride=useCallback((empId,moStr,field,oldVal,newVal,reason)=>{
    const entry={id:Date.now()+"",field,oldVal,newVal,reason,ts:new Date().toISOString()};
    setPayrollOverrides(prev=>({...prev,[`${empId}_${moStr}`]:[...(prev[`${empId}_${moStr}`]||[]),entry]}));
  },[]);

  const undoPayrollOverride=useCallback((empId,moStr,entryId)=>{
    setPayrollOverrides(prev=>({...prev,[`${empId}_${moStr}`]:(prev[`${empId}_${moStr}`]||[]).filter(e=>e.id!==entryId)}));
  },[]);
  const openPopup=useCallback((careId,shiftIdx,currentEmpId,e)=>{
    e.stopPropagation();
    const r=e.currentTarget.getBoundingClientRect();
    setShiftPopup({careId,shiftIdx,currentEmpId,x:r.left,y:r.bottom});
  },[]);

  const reassignShift=useCallback((newEmpId)=>{
    if(!shiftPopup) return;
    const {careId,shiftIdx}=shiftPopup;
    setSchedule(prev=>{
      const shifts=[...(prev[careId]||[])];
      if(!shifts[shiftIdx]) return prev;
      const origEmpId=shifts[shiftIdx].originalEmpId||shifts[shiftIdx].employeeId;
      const wasOpen=shifts[shiftIdx].open;
      shifts[shiftIdx]={...shifts[shiftIdx],employeeId:newEmpId,open:false,conflict:false,
        originalEmpId:origEmpId,takenOver:origEmpId!==newEmpId,takenOverBy:origEmpId!==newEmpId?newEmpId:undefined};
      return{...prev,[careId]:shifts};
    });
    // Track takeover in shiftTakeovers for payroll (only if actually changed)
    const oldEmpId=shiftPopup.currentEmpId;
    if(oldEmpId!==newEmpId){
      const shift=schedule[shiftPopup.careId]?.[shiftPopup.shiftIdx];
      if(shift){
        setShiftTakeovers(prev=>[...prev,{
          id:Date.now()+"",careId:Number(shiftPopup.careId),shiftIdx,
          originalEmpId:oldEmpId,newEmpId,
          date:shift.startDate,durationH:shift.durationH,
          confirmedAt:new Date().toISOString()
        }]);
      }
    }
    setShiftPopup(null);
    const emp=employees.find(e=>e.id===newEmpId);
    addNotification("shift_changed",`✏️ Schicht umgeplant → ${emp?.name}`,[newEmpId]);
    if(emp?.email){
      const subject="ShiftCare: Schichtänderung";
      const body=`Hallo ${emp.name},\n\ndu wurdest für eine Schicht eingeplant. Bitte prüfe deinen aktuellen Plan in ShiftCare.`;
      addPendingEmail(emp.email,subject,body,`Schichtänderung → ${emp.name}`);
    }
  },[shiftPopup,employees,schedule,addNotification,addPendingEmail]);

  const deleteShift=useCallback(()=>{
    if(!shiftPopup) return;
    const {careId,shiftIdx}=shiftPopup;
    setSchedule(prev=>({...prev,[careId]:(prev[careId]||[]).filter((_,i)=>i!==shiftIdx)}));
    setShiftPopup(null);
  },[shiftPopup]);

  // Generate
  const generatePlan=async()=>{
    setGenLoading(true);setGenError(null);setGenWarns([]);
    let ok=false;
    try{
      const{schedule:newSched,warnings}=generateRuleBased({
        employees,care,empPrefs,empConstraints,carePrefs,vacReqs,sickReqs,
        adminAbsence,freistellung,planPrefs,planYear,planMonth,holidayStats
      });
      setSchedule(prev=>{
        const merged={...prev};
        Object.entries(newSched).forEach(([cId,shifts])=>{
          const existing=(merged[cId]||[]).filter(s=>{
            const[sy,sm]=s.startDate.split("-").map(Number);
            return sy!==planYear||sm!==planMonth;
          });
          merged[cId]=[...existing,...shifts];
        });
        return merged;
      });setGenWarns(warnings);
      addNotification("plan_published",`Plan ${MONTHS_DE[planMonth-1]} ${planYear} generiert`);
      addAudit("plan_generated",`Plan ${MONTHS_DE[planMonth-1]} ${planYear} generiert (${warnings.length} Konflikte)`);
      ok=true;
    }catch(err){setGenError("Fehler: "+err.message);}
    setGenLoading(false);
    return ok;
  };

  // ── DATEV LODAS Export (echtes LODAS Lohndaten-Importformat) ─────────────
  const exportCSV=useCallback((sep=";",filterEmpId=null)=>{
    const{holiday:holPct,sunday:sunPct,night:nightPct,nightStart,nightEnd}=surcharges;
    const moStr=`${planYear}-${fmt2(planMonth)}`;
    const abrNr=`${planYear}${fmt2(planMonth)}`; // YYYYMM
    const empList=filterEmpId?employees.filter(e=>e.id===filterEmpId):employees;
    const la=lodasLohnarten||DEFAULT_LODAS_LOHNARTEN;
    const fmtDE=(n)=>typeof n==="number"?n.toFixed(2).replace(".",","):String(n??"-");
    const fmtH=(n)=>typeof n==="number"?n.toFixed(2).replace(".",","):"0,00";

    // ── Aufbau LODAS Lohndaten-Import ───────────────────────────────
    // Header
    const lines = [
      "$$LODAS",
      `$ Exportiert von ShiftCare v6 – ${new Date().toLocaleDateString("de-DE")}`,
      `$ Buchungsmonat: ${fmt2(planMonth)}/${planYear}`,
      `$ Betriebsnummer: ${betriebsNr||"(nicht gesetzt)"}`,
      `$ §3b EStG: Feiertag ${holPct}%, Sonntag ${sunPct}%, Nacht ${nightPct}% (${fmt2(nightStart)}-${fmt2(nightEnd)} Uhr)`,
      `$ Abrechnungsnummer; Personalnummer; Lohnart; Anzahl/Stunden; Betrag`,
      `$---`,
    ];

    empList.forEach(emp => {
      const rate = emp.hourlyRate || 0;
      const persNr = (emp.personalNr || String(emp.id).padStart(5,"0")).padStart(5,"0");

      // Alle Schichten dieses MA in diesem Monat (inkl. manueller Änderungen)
      let totalH=0, holH=0, sunH=0, nightH=0;
      care.forEach(c => {
        const hMap = holidayMaps[c.id] || defaultHolidayMap;
        (schedule[c.id]||[]).forEach(s => {
          const[sy,sm]=s.startDate.split("-").map(Number);
          if(sy!==planYear||sm!==planMonth) return;
          if(s.employeeId!==emp.id) return;
          const hrs = calcShiftHours(s.startDate, c.shiftStartHour, s.durationH, hMap, nightStart, nightEnd, c.shiftStartsEve);
          totalH += s.durationH;
          holH   += hrs.holH;
          sunH   += hrs.sunH;
          nightH += hrs.nightH;
        });
      });

      // Schichtübernahmen berücksichtigen (in diesem MA bereits im schedule enthalten)
      const takenOver = shiftTakeovers.filter(t=>t.newEmpId===emp.id&&t.date.startsWith(moStr)).length;
      const gaveAway  = shiftTakeovers.filter(t=>t.originalEmpId===emp.id&&t.date.startsWith(moStr)).length;

      const grundlohn = totalH * rate;
      const holS  = (holPct/100) * rate * holH;
      const sunS  = (sunPct/100) * rate * sunH;
      const nightS= (nightPct/100) * rate * nightH;

      // Urlaubstage (genehmigt, in diesem Monat)
      const vacDays = (vacReqs[emp.id]?.[planYear]||[])
        .filter(r=>r.status==="approved")
        .flatMap(r=>r.adminDates||r.dates)
        .filter(d=>d.startsWith(moStr)).length;
      const dailyH = emp.dailyContractHours ?? 8;
      const vacStunden = vacDays * dailyH;
      const vacLohn = vacStunden * rate;

      // Krankheitstage (bestätigt, in diesem Monat) – EFZG Lohnfortzahlung
      const sickDaysMonth = (sickReqs[emp.id]?.[planYear]||[])
        .filter(r=>r.status==="confirmed")
        .flatMap(r=>r.dates)
        .filter(d=>d.startsWith(moStr)).length;
      const sickStunden = sickDaysMonth * dailyH;
      const sickLohn = sickStunden * rate;

      // EFZG kumuliert (für 42-Tage-Regel)
      const sickDaysYear = (sickReqs[emp.id]?.[planYear]||[])
        .filter(r=>r.status==="confirmed").reduce((a,r)=>a+r.dates.length,0);

      // Manuelle Overrides berücksichtigen
      const overrides = payrollOverrides?.[`${emp.id}_${moStr}`]||[];
      const getOverride = (field, base) => {
        const ov = overrides.filter(o=>o.field===field).at(-1);
        return ov ? parseFloat(String(ov.newVal).replace(",",".")) : base;
      };
      const effGrundlohn = getOverride("grundlohn", grundlohn);
      const effVacLohn   = getOverride("vacLohn", vacLohn);
      const effSickLohn  = getOverride("sickLohn", sickLohn);

      // Brutto
      const brutto = effGrundlohn + holS + sunS + nightS + effVacLohn + effSickLohn;

      const isEFZGok = sickDaysYear <= 42;
      const kommentar = [
        takenOver>0?`Übernahmen:+${takenOver}`:"",
        gaveAway>0?`Abgegeben:-${gaveAway}`:"",
        !isEFZGok?`⚠️ EFZG>${sickDaysYear}T`:"",
        overrides.length>0?`Angepasst:${overrides.length}x`:"",
      ].filter(Boolean).join(" | ");

      lines.push(`$ ─── ${emp.name} (Pers-Nr: ${persNr}) ───────────`);

      // Grundlohn (Lohnart 101) – nur wenn Stunden > 0
      if(totalH>0){
        lines.push([abrNr, persNr, la.grundlohn, fmtH(totalH), fmtDE(effGrundlohn)].join(sep));
      }
      // Feiertagszuschlag (steuerfrei)
      if(holH>0){
        lines.push([abrNr, persNr, la.feiertag, fmtH(holH), fmtDE(holS)].join(sep));
      }
      // Sonntagszuschlag (steuerfrei)
      if(sunH>0){
        lines.push([abrNr, persNr, la.sonntag, fmtH(sunH), fmtDE(sunS)].join(sep));
      }
      // Nachtzuschlag (steuerfrei)
      if(nightH>0){
        lines.push([abrNr, persNr, la.nacht, fmtH(nightH), fmtDE(nightS)].join(sep));
      }
      // Urlaubsentgelt
      if(vacStunden>0){
        lines.push([abrNr, persNr, la.urlaub, fmtH(vacStunden), fmtDE(effVacLohn)].join(sep));
      }
      // Lohnfortzahlung Krankheit (EFZG)
      if(sickStunden>0 && isEFZGok){
        lines.push([abrNr, persNr, la.efzg, fmtH(sickStunden), fmtDE(effSickLohn)].join(sep));
      }
      // Krankheit nach 6 Wochen → Krankengeldzeitraum (kein Lohn)
      if(sickStunden>0 && !isEFZGok){
        lines.push([abrNr, persNr, la.efzg, fmtH(sickStunden), "0,00"].join(sep));
        lines.push(`$ ⚠️ EFZG überschritten (${sickDaysYear} Tage) – kein Lohnanspruch`);
      }
      // Brutto-Summe als Kommentarzeile (nicht importiert, nur zur Prüfung)
      lines.push(`$ BRUTTO: ${fmtDE(brutto)} EUR${kommentar?" | "+kommentar:""}`);
      lines.push("");
    });

    // Ausgabe als .csv (LODAS erkennt an $$-Header)
    const bom = "\uFEFF";
    const content = bom + lines.join("\r\n");
    const blob = new Blob([content], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const fname = filterEmpId
      ? `LODAS_${employees.find(e=>e.id===filterEmpId)?.name.replace(/\s/g,"_")}_${planYear}-${fmt2(planMonth)}.csv`
      : `LODAS_Abrechnung_${planYear}-${fmt2(planMonth)}.csv`;
    const a=document.createElement("a");a.href=url;a.download=fname;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);

    // Auch als normales Lohnjournal für Excel (separater Download)
    if(!filterEmpId){
      const xlsHdr=["Monat","Personalnummer","Name","Pensum_%","Stundensatz_EUR",
        "Schichten","Stunden_geleistet","Feiertag-Std","Feiertag-EUR",
        "Sonntag-Std","Sonntag-EUR","Nacht-Std","Nacht-EUR",
        "Urlaub-Tage","Urlaub-Std","Urlaub-EUR",
        "Krank-Tage-Monat","Krank-Std","Krank-EUR-EFZG",
        "Grundlohn-EUR","Zuschlage-EUR","Brutto-EUR","EFZG-Status","Notiz"];
      const xlsRows=[xlsHdr];
      empList.forEach(emp=>{
        const rate=emp.hourlyRate||0,persNr=(emp.personalNr||String(emp.id)).padStart(5,"0");
        const dailyH=emp.dailyContractHours??8;
        let totalH2=0,holH2=0,sunH2=0,nH2=0,shifts2=0;
        care.forEach(c=>{
          const hMap=holidayMaps[c.id]||defaultHolidayMap;
          (schedule[c.id]||[]).forEach(s=>{
            const[sy,sm]=s.startDate.split("-").map(Number);
            if(sy!==planYear||sm!==planMonth||s.employeeId!==emp.id) return;
            const hrs=calcShiftHours(s.startDate,c.shiftStartHour,s.durationH,hMap,nightStart,nightEnd,c.shiftStartsEve);
            totalH2+=s.durationH;holH2+=hrs.holH;sunH2+=hrs.sunH;nH2+=hrs.nightH;shifts2++;
          });
        });
        const vD=(vacReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="approved").flatMap(r=>r.adminDates||r.dates).filter(d=>d.startsWith(moStr)).length;
        const sD=(sickReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="confirmed").flatMap(r=>r.dates).filter(d=>d.startsWith(moStr)).length;
        const sDY=(sickReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="confirmed").reduce((a,r)=>a+r.dates.length,0);
        const gl=totalH2*rate,hS=(holPct/100)*rate*holH2,sS=(sunPct/100)*rate*sunH2,nS=(nightPct/100)*rate*nH2;
        const vL=vD*dailyH*rate,skL=sD*dailyH*rate;
        const brutto2=gl+hS+sS+nS+vL+(sDY<=42?skL:0);
        xlsRows.push([`${MONTHS_DE[planMonth-1]} ${planYear}`,persNr,emp.name,emp.pensumPct,
          rate.toFixed(2),shifts2,totalH2,holH2,hS.toFixed(2),sunH2,sS.toFixed(2),nH2,nS.toFixed(2),
          vD,vD*dailyH,vL.toFixed(2),sD,sD*dailyH,sDY<=42?skL.toFixed(2):"0,00",
          gl.toFixed(2),(hS+sS+nS).toFixed(2),brutto2.toFixed(2),
          sDY<=42?"EFZG aktiv":"EFZG überschritten!",""]);
      });
      const xlsCsv="\uFEFF"+xlsRows.map(r=>r.map(x=>`"${String(x??'').replace(/"/g,'""')}"`).join(";")).join("\r\n");
      const xlsBlob=new Blob([xlsCsv],{type:"text/csv;charset=utf-8;"});
      const xlsUrl=URL.createObjectURL(xlsBlob);
      const xlsA=document.createElement("a");xlsA.href=xlsUrl;xlsA.download=`Lohnjournal_${planYear}-${fmt2(planMonth)}.csv`;
      document.body.appendChild(xlsA);xlsA.click();document.body.removeChild(xlsA);URL.revokeObjectURL(xlsUrl);
    }
  },[employees,care,schedule,surcharges,holidayMaps,defaultHolidayMap,vacReqs,sickReqs,
     shiftTakeovers,payrollOverrides,lodasLohnarten,betriebsNr,planYear,planMonth]);

  // Tabs
  const ALL_TABS=[
    {id:"setup",    icon:"⚙️",  label:"Team & Setup", adminOnly:true},
    {id:"prefs",    icon:"📅",  label:"Wünsche",      adminOnly:false},
    {id:"abwesenheit",icon:"🏖️",label:"Abwesenheit",  adminOnly:false},
    {id:"plan",     icon:"📋",  label:"Plan",          adminOnly:false},
    {id:"todos",    icon:"✅",  label:"To-Do's",       adminOnly:false},
    {id:"howto",    icon:"📖",  label:"How-To",        adminOnly:false},
    {id:"notfall",  icon:"🚨",  label:"Notfall",       adminOnly:false},
    {id:"settings", icon:"⚙️",  label:"Einstellungen", adminOnly:false},
    {id:"abrechnung",icon:"💰", label:"Abrechnung",    adminOnly:true},
  ];
  const TABS=ALL_TABS.filter(t=>isAdmin||!t.adminOnly);

  // LOGIN
  const handleLogin=async()=>{
    const {email,password}=loginForm;
    if(!email||!password){setLoginForm(f=>({...f,error:"Bitte E-Mail und Passwort eingeben."}));return;}
    // Phase 2: Try Backend API first
    if(backendCfg?.enabled&&backendCfg?.url){
      BackendAPI.configure(backendCfg.url);
      const r=await BackendAPI.login(email.trim(),password);
      if(r?.token){
        setUser({role:r.user.role,empId:r.user.empId});
        setTab(r.user.role==="admin"?"setup":"plan");
        setLoginForm({email:"",password:"",error:""});
        // Load state from backend
        const state=await BackendAPI.loadState();
        if(state?.data&&Object.keys(state.data).length>0) applyData(state.data);
        return;
      }
      if(r?.error&&r.error!=="session_expired"){
        setLoginForm(f=>({...f,error:r.error==="Ungültige Anmeldedaten"?"Falsches Passwort oder E-Mail.":r.error}));
        return;
      }
    }
    // Fallback: Local auth (offline mode)
    const effectiveAdminEmail=(adminEmail||"admin@example.de").trim();
    if(email.trim()===effectiveAdminEmail){
      const expected=passwords.admin||btoa("admin123");
      if(btoa(password)===expected){
        setUser({role:"admin"});setTab("setup");setLoginForm({email:"",password:"",error:""});
        if(employees.length<=6&&employees[0]?.name==="Anna M."&&!Object.keys(schedule).length) setOnboardingStep(1);
        return;
      }
      setLoginForm(f=>({...f,error:"Falsches Passwort."}));return;
    }
    const emp=employees.find(e=>e.email&&e.email.trim()===email.trim());
    if(emp){
      const expected=passwords[emp.id]||btoa("0000");
      if(btoa(password)===expected){setUser({role:"employee",empId:emp.id});setTab("plan");setLoginForm({email:"",password:"",error:""});return;}
      setLoginForm(f=>({...f,error:"Falsches Passwort."}));return;
    }
    setLoginForm(f=>({...f,error:"E-Mail nicht gefunden."}));
  };
  if(!user) return(
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo"><div className="login-logo-icon">S</div><div className="login-logo-text">ShiftCare</div></div>
        <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:16,textAlign:"center"}}>Anmelden</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div>
            <div className="lbl">E-Mail-Adresse</div>
            <input className="sc-input" type="email" placeholder="name@example.de" autoComplete="email"
              value={loginForm.email}
              onChange={e=>setLoginForm(f=>({...f,email:e.target.value,error:""}))}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          </div>
          <div>
            <div className="lbl">Passwort</div>
            <input className="sc-input" type="password" placeholder="••••••••" autoComplete="current-password"
              value={loginForm.password}
              onChange={e=>setLoginForm(f=>({...f,password:e.target.value,error:""}))}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          </div>
          {loginForm.error&&<div className="al al-err" style={{padding:"6px 10px",fontSize:11}}>{loginForm.error}</div>}
          <button className="sc-btn sc-btn-p" style={{width:"100%",padding:"11px 0",fontSize:13,marginTop:4}} onClick={handleLogin}>Anmelden →</button>
        </div>
        <hr className="login-sep"/>
        <div className="al al-info" style={{fontSize:10,marginBottom:0}}>
          <strong>Standard-Zugangsdaten:</strong><br/>
          Admin: {adminEmail||"admin@example.de"} · PW: <em>admin123</em><br/>
          Mitarbeiter/in: Ihre E-Mail · PW: <em>0000</em> (vom Admin änderbar)
        </div>
        <div style={{fontSize:9,color:"#94A3B8",textAlign:"center",marginTop:8}}>
          🔒 DSGVO-konform · Daten lokal gespeichert · EU-Hosting
        </div>
      </div>
    </div>
  );

  return(
    <div className="sc" onClick={()=>{shiftPopup&&setShiftPopup(null);showPendingEmails&&setShowPendingEmails(false);}}>
      {confirmDel&&<ConfirmDialog title="🗑️ Mitarbeiter löschen?" message={`Wirklich <strong style="color:#EF4444">${confirmDel.name}</strong> entfernen?`} onConfirm={()=>{setEmployees(p=>p.filter(x=>x.id!==confirmDel.id));if(expandedEmp===confirmDel.id)setExpandedEmp(null);setConfirmDel(null);}} onCancel={()=>setConfirmDel(null)}/>}
      {shiftPopup&&<ShiftPopup popup={shiftPopup} employees={activeEmployees} onReassign={reassignShift} onDelete={deleteShift} onClose={()=>setShiftPopup(null)}/>}
      {emailDlg&&<EmailDialog {...emailDlg} onClose={()=>setEmailDlg(null)}/>}
      {/* Pending email queue dialog */}
      {showPendingEmails&&pendingEmails.length>0&&(
        <div className="dlg-overlay" onClick={e=>{e.stopPropagation();setShowPendingEmails(false);}}>
          <div className="dlg" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📧 Ausstehende Benachrichtigungen ({pendingEmails.length})</div>
            <div style={{maxHeight:320,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
              {pendingEmails.map((pe,i)=>(
                <div key={pe.id} style={{background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0",padding:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:11,fontWeight:700,flex:1,color:"#1E293B"}}>{pe.label}</span>
                    <button onClick={()=>setPendingEmails(p=>p.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",cursor:"pointer",color:"#94A3B8",fontSize:14,padding:"0 2px"}}>×</button>
                  </div>
                  <div style={{fontSize:10,color:"#64748B"}}>An: {pe.to}</div>
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <button className="sc-btn sc-btn-p" style={{fontSize:10,padding:"4px 10px",flex:1}} onClick={()=>{setEmailDlg({to:pe.to,subject:pe.subject,body:pe.body});setPendingEmails(p=>p.filter((_,j)=>j!==i));}}>📧 Senden</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="sc-btn sc-btn-s" style={{flex:1}} onClick={()=>setShowPendingEmails(false)}>Schließen</button>
              <button className="sc-btn sc-btn-r" style={{fontSize:11}} onClick={()=>setPendingEmails([])}>Alle verwerfen</button>
            </div>
          </div>
        </div>
      )}
      {/* Onboarding Wizard */}
      {onboardingStep&&(
        <div className="dlg-overlay" onClick={()=>setOnboardingStep(null)}>
          <div className="dlg" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[1,2,3,4].map(s=>(
                <div key={s} style={{flex:1,height:4,borderRadius:2,background:s<=onboardingStep?"var(--sc-accent)":"var(--sc-border)"}}/>
              ))}
            </div>
            {onboardingStep===1&&(
              <div>
                <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>Willkommen bei ShiftCare</div>
                <div style={{fontSize:13,color:"var(--sc-text-2)",marginBottom:16}}>In wenigen Schritten richtest du dein Team ein. Alles kann später unter "Team & Setup" angepasst werden.</div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Schritt 1: Arbeitgeber anlegen</div>
                <div style={{fontSize:12,color:"var(--sc-text-2)",marginBottom:12}}>Wer wird betreut? Lege die pflegebedürftigen Personen an, für die Schichten geplant werden.</div>
                <div className="al al-info" style={{fontSize:11,marginBottom:12}}>Du kannst unter "Team & Setup → Arbeitgeber" jederzeit weitere hinzufügen oder bearbeiten.</div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button className="sc-btn sc-btn-s" onClick={()=>setOnboardingStep(null)}>Überspringen</button>
                  <button className="sc-btn sc-btn-p" onClick={()=>{setTab("setup");setOnboardingStep(2);}}>Weiter →</button>
                </div>
              </div>
            )}
            {onboardingStep===2&&(
              <div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Schritt 2: Mitarbeiter einrichten</div>
                <div style={{fontSize:12,color:"var(--sc-text-2)",marginBottom:12}}>Trage dein Assistenzteam ein: Name, Pensum, Stundenlohn, E-Mail für Login. Die Beispiel-Mitarbeiter kannst du löschen oder überschreiben.</div>
                <div className="al al-info" style={{fontSize:11,marginBottom:12}}>Wichtig: E-Mail + Passwort ermöglichen den Login für Mitarbeiter. Standard-Passwort: 0000.</div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button className="sc-btn sc-btn-s" onClick={()=>setOnboardingStep(1)}>← Zurück</button>
                  <button className="sc-btn sc-btn-p" onClick={()=>setOnboardingStep(3)}>Weiter →</button>
                </div>
              </div>
            )}
            {onboardingStep===3&&(
              <div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Schritt 3: Schichtkonfiguration</div>
                <div style={{fontSize:12,color:"var(--sc-text-2)",marginBottom:12}}>Stelle pro Arbeitgeber ein: Schichtlänge (z.B. 8h, 12h, 24h), Schichtbeginn, maximale aufeinanderfolgende Schichten und ob alle 24h abgedeckt sein müssen.</div>
                <div className="al al-info" style={{fontSize:11,marginBottom:12}}>Bei 24h-Abdeckung mit 8h-Schichten werden automatisch 3 Schichten pro Tag geplant.</div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button className="sc-btn sc-btn-s" onClick={()=>setOnboardingStep(2)}>← Zurück</button>
                  <button className="sc-btn sc-btn-p" onClick={()=>setOnboardingStep(4)}>Weiter →</button>
                </div>
              </div>
            )}
            {onboardingStep===4&&(
              <div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Schritt 4: Ersten Plan erstellen</div>
                <div style={{fontSize:12,color:"var(--sc-text-2)",marginBottom:12}}>Gehe zum Plan-Tab, klicke auf "Plan generieren" und der Algorithmus erstellt den Schichtplan basierend auf Pensum, Wünschen und Verfügbarkeit.</div>
                <div className="al al-ok" style={{fontSize:11,marginBottom:12}}>Tipp: Lass zuerst dein Team unter "Wünsche" ihre Verfügbarkeit und Präferenzen eintragen, bevor du den Plan generierst.</div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button className="sc-btn sc-btn-s" onClick={()=>setOnboardingStep(3)}>← Zurück</button>
                  <button className="sc-btn sc-btn-g" onClick={()=>{setOnboardingStep(null);setTab("setup");}}>✓ Einrichtung starten</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* DSGVO Banner */}
      {!dsgvoConsent&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9999,background:"#1E293B",color:"#F8FAFC",padding:"12px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",fontSize:12}}>
          <span style={{flex:1}}>🔒 <strong>Datenschutz (DSGVO):</strong> ShiftCare speichert Daten ausschließlich lokal in Ihrem Browser. Es werden keine personenbezogenen Daten an externe Server übertragen.</span>
          <button onClick={()=>{setDsgvoConsent(true);try{localStorage.setItem("sc_dsgvo","yes");}catch{}}} className="sc-btn sc-btn-p" style={{fontSize:11,whiteSpace:"nowrap"}}>Verstanden & Akzeptieren</button>
        </div>
      )}

      <NavHeader
        tab={tab} setTab={setTab} prevTab={prevTab} setPrevTab={setPrevTab}
        TABS={TABS}
        isAdmin={isAdmin} myEmp={myEmp}
        planMonth={planMonth} setPlanMonth={setPlanMonth}
        planYear={planYear} setPlanYear={setPlanYear}
        unreadCount={unreadCount}
        pendingEmails={pendingEmails} setPendingEmails={setPendingEmails}
        showPendingEmails={showPendingEmails} setShowPendingEmails={setShowPendingEmails}
        syncStatus={syncStatus} ionosCfg={ionosCfg}
        onLogout={()=>{BackendAPI.logout().catch(()=>{});BackendAPI.clearTokens();setUser(null);}}
        emergencyContacts={emergencyContacts}
        teamEmployees={employees}
        appSettings={appSettings}
      />

      <main className="sc-main" onClick={e=>e.stopPropagation()}>
        {tab==="setup"&&isAdmin&&<SetupTab employees={employees} setEmployees={setEmployees} care={care} setCare={setCare} surcharges={surcharges} setSurcharges={setSurcharges} limits={limits} setLimits={setLimits} adminEmail={adminEmail} setAdminEmail={setAdminEmail} adminAbsence={adminAbsence} setAdminAbsence={setAdminAbsence} freistellung={freistellung} setFreistellung={setFreistellung} expandedEmp={expandedEmp} setExpandedEmp={setExpandedEmp} setConfirmDel={setConfirmDel} getMaxH={getMaxH} planPrefs={planPrefs} setPlanPrefs={setPlanPrefs} appSettings={appSettings} setAppSettings={setAppSettings} shiftPatterns={shiftPatterns} setShiftPatterns={setShiftPatterns} passwords={passwords} setPasswords={setPasswords} ionosCfg={ionosCfg} setIonosCfg={(cfg)=>{setIonosCfg(cfg);try{localStorage.setItem("sc_ionos",JSON.stringify(cfg));}catch{}}} backendCfg={backendCfg} setBackendCfg={(cfg)=>{setBackendCfg(cfg);try{localStorage.setItem("sc_backend",JSON.stringify(cfg));if(cfg.url)localStorage.setItem("sc_api_url",cfg.url);}catch{}}} betriebsNr={betriebsNr} setBetriebsNr={setBetriebsNr} lodasLohnarten={lodasLohnarten} setLodasLohnarten={setLodasLohnarten} syncStatus={syncStatus} setSyncStatus={setSyncStatus} loadFromIONOS={loadFromIONOS} applyData={applyData} emergencyContacts={emergencyContacts} setEmergencyContacts={setEmergencyContacts}/>}
        {tab==="prefs"&&<PrefsTab employees={employees} care={care} isAdmin={isAdmin} myEmp={myEmp} planYear={planYear} planMonth={planMonth} limits={limits} getEmpP={getEmpP} getEmpC={getEmpC} toggleEmpP={toggleEmpP} toggleEmpC={toggleEmpC} getCareP={(cId,y,m)=>carePrefs[cId]?.[y]?.[m]||{}} setCareAssist={(cId,d,eId,y,m)=>setCarePrefs(prev=>{const yr=prev[cId]?.[y]||{};const mo={...(yr[m]||{})};mo[d]===eId?delete mo[d]:(mo[d]=eId);return{...prev,[cId]:{...prev[cId],[y]:{...yr,[m]:mo}}};}) } defaultHolidayMap={defaultHolidayMap} defaultHolidaySet={defaultHolidaySet}/>}
        {/* Abwesenheit = Urlaub + Krankmeldung */}
        {tab==="abwesenheit"&&<AbwesenheitTab
          employees={employees} isAdmin={isAdmin} myEmp={myEmp}
          planYear={planYear} planMonth={planMonth} numDays={numDays}
          defaultHolidaySet={defaultHolidaySet} defaultHolidayMap={defaultHolidayMap}
          vacReqs={vacReqs} getVacUsed={getVacUsed} submitVac={submitVac} updateVac={updateVac} calcVacationDays={calcVacationDays}
          sickReqs={sickReqs} submitSick={submitSick} confirmSick={confirmSick} setSickReqs={setSickReqs}/>}

        {/* Plan = Schichtplan + Generieren + PDF */}
        {tab==="plan"&&<PlanTab
          employees={employees} activeEmployees={activeEmployees} care={care} schedule={schedule}
          isAdmin={isAdmin} myEmp={myEmp}
          planYear={planYear} setPlanYear={setPlanYear} planMonth={planMonth} setPlanMonth={setPlanMonth} numDays={numDays}
          holidayMaps={holidayMaps} defaultHolidaySet={defaultHolidaySet} defaultHolidayMap={defaultHolidayMap}
          empPrefs={empPrefs} empConstraints={empConstraints} vacReqs={vacReqs} sickReqs={sickReqs} adminAbsence={adminAbsence}
          getEmpP={getEmpP} getEmpC={getEmpC} getApprovedVacDates={getApprovedVacDates} getSickDates={getSickDates}
          openPopup={openPopup} empHours={empHours} getMaxH={getMaxH}
          filters={scheduleFilters} setFilters={setScheduleFilters} setTab={setTab}
          takeoverShift={takeoverShift} shiftTakeovers={shiftTakeovers}
          pendingTakeovers={pendingTakeovers} confirmTakeover={confirmTakeover} setPendingTakeovers={setPendingTakeovers}
          appSettings={appSettings} requestSwap={requestSwap} swapRequests={swapRequests}
          confirmSwap={confirmSwap} rejectSwap={rejectSwap}
          shiftAdjustments={shiftAdjustments} requestShiftAdjust={requestShiftAdjust}
          confirmShiftAdjust={null} rejectShiftAdjust={null}
          reviewMonthChanges={reviewMonthChanges}
          genLoading={genLoading} genError={genError} genWarns={genWarns} onGenerate={generatePlan}
          planPrefs={planPrefs} setPlanPrefs={setPlanPrefs}
          holidayStats={holidayStats} setHolidayStats={setHolidayStats}
          planConfirmations={planConfirmations} setPlanConfirmations={setPlanConfirmations}
          planVersions={planVersions} addAudit={addAudit}/>}

        {/* Abrechnung */}
        {tab==="abrechnung"&&isAdmin&&<AbrechnungTab
          employees={employees} care={care} schedule={schedule} surcharges={surcharges}
          holidayMaps={holidayMaps} defaultHolidayMap={defaultHolidayMap}
          planYear={planYear} planMonth={planMonth}
          sickReqs={sickReqs} vacReqs={vacReqs}
          payrollConf={payrollConf} setPayrollConf={setPayrollConf}
          getMaxH={getMaxH} exportCSV={exportCSV}
          shiftTakeovers={shiftTakeovers} appSettings={appSettings} setAppSettings={setAppSettings}
          payrollOverrides={payrollOverrides} applyPayrollOverride={applyPayrollOverride} undoPayrollOverride={undoPayrollOverride}
          holidayStats={holidayStats}
          shiftAdjustments={shiftAdjustments} reviewMonthChanges={reviewMonthChanges}
          planConfirmations={planConfirmations} activeEmployees={activeEmployees} planVersions={planVersions}
          addAudit={addAudit} auditLog={auditLog}/>}

        {tab==="howto"&&<HowToTab items={howtoItems} setItems={setHowtoItems} isAdmin={isAdmin}/>}
        {tab==="notfall"&&<NotfallTab contacts={emergencyContacts}/>}
        {tab==="settings"&&<SettingsTab isAdmin={isAdmin} myEmp={myEmp} user={user} passwords={passwords} setPasswords={setPasswords} appSettings={appSettings} setAppSettings={setAppSettings}/>}
        {tab==="todos"&&<PutzplanTab care={care} employees={employees} isAdmin={isAdmin} myEmp={myEmp} cleaningTasks={cleaningTasks} setCleaningTasks={setCleaningTasks} cleaningLog={cleaningLog} setCleaningLog={setCleaningLog} schedule={schedule} planYear={planYear} planMonth={planMonth}/>}
        {tab==="notifications"&&<NotificationsTab notifications={notifications} setNotifications={setNotifications} isAdmin={isAdmin} myEmp={myEmp} setTab={setTab}/>}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MERGED TAB WRAPPERS
// ═══════════════════════════════════════════════════════════════

function AbwesenheitTab(props) {
  const [subTab, setSubTab] = useState("vacation");
  const btnStyle = (id) => ({
    padding:"8px 20px",borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",
    fontSize:13,fontWeight:subTab===id?700:500,transition:"all .15s",
    background:subTab===id?"#0EA5E9":"#F1F5F9",
    color:subTab===id?"#fff":"#475569",
  });
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button style={btnStyle("vacation")} onClick={()=>setSubTab("vacation")}>🏖️ Urlaub</button>
        <button style={btnStyle("sick")}     onClick={()=>setSubTab("sick")}>🤒 Krankmeldung</button>
      </div>
      {subTab==="vacation"&&<VacationTab {...props}/>}
      {subTab==="sick"&&<SickTab {...props}/>}
    </div>
  );
}

function PlanTab(props) {
  const [showGen, setShowGen] = useState(false);
  const {activeEmployees,care,schedule,planYear,planMonth,numDays,defaultHolidaySet,
    holidayMaps,empHours,getMaxH,getEmpP,getEmpC,getApprovedVacDates,getSickDates,isAdmin}=props;

  const handleGenerate=async()=>{
    const ok=await props.onGenerate();
    if(ok) setShowGen(false);
  };

  const buildPDF=()=>{
    const days=Array.from({length:numDays},(_,i)=>i+1);
    const hSet=defaultHolidaySet;
    const wm={};
    activeEmployees.forEach(e=>{
      const p=getEmpP(e.id,planYear,planMonth);
      const cnt=getEmpC?.(e.id,planYear,planMonth)||{};
      const va=getApprovedVacDates(e.id,planYear);
      const sc=getSickDates(e.id,planYear);
      wm[e.id]={off:p.wishOff||new Set(),work:p.wishWork||new Set(),vac:va,sick:sc,cannot:cnt.canDates||new Set()};
    });
    const maxNameLen=Math.max(...activeEmployees.map(e=>e.name.length),4);
    const nameW=Math.min(28,Math.max(16,Math.round(maxNameLen*2)));
    const hdr=`<tr>
      <th class="nc">MA</th>
      ${days.map(d=>{
        const dt=fmtDate(planYear,planMonth,d),hol=hSet.has(dt),we=isWeekend(planYear,planMonth,d);
        const wd=DAYS_SHORT[getWeekday(planYear,planMonth,d)];
        const cls=hol?"hol":we?"we":"";
        return`<th class="${cls}"><div class="dn">${d}</div><div class="dw">${wd}</div></th>`;
      }).join("")}
      <th class="nc hc">Std</th>
    </tr>`;
    const rows=activeEmployees.map(emp=>{
      const maxH=getMaxH(emp),istH=empHours[emp.id]||0;
      const over=istH>maxH;
      const cells=days.map(d=>{
        const dt=fmtDate(planYear,planMonth,d);
        const hol=hSet.has(dt),we=isWeekend(planYear,planMonth,d);
        let inner="",cellCls=hol?"hol":we?"we":"";
        care.forEach(c=>{
          (schedule[c.id]||[]).forEach(s=>{
            if(s.employeeId!==emp.id) return;
            const[sy,sm,sd]=s.startDate.split("-").map(Number);
            if(fmtDate(sy,sm,sd)!==dt) return;
            inner=`<div class="sh" style="background:${emp.color}">${s.durationH}</div>`;
          });
        });
        if(!inner){
          if(wm[emp.id]?.sick.has(dt)){cellCls="st-sick";inner='<div class="st">K</div>';}
          else if(wm[emp.id]?.vac.has(dt)){cellCls="st-vac";inner='<div class="st">U</div>';}
          else if(wm[emp.id]?.off.has(dt)){cellCls="st-off";inner='<div class="st">F</div>';}
          else if(wm[emp.id]?.work.has(dt)){cellCls="st-work";inner='<div class="st">W</div>';}
          else if(wm[emp.id]?.cannot.has(dt)){cellCls="st-cant";inner='<div class="st">\u2013</div>';}
        }
        return`<td class="${cellCls}">${inner}</td>`;
      }).join("");
      return`<tr><td class="nm" style="border-left:3px solid ${emp.color}"><div class="nm-n">${emp.name}</div></td>${cells}<td class="hrs" style="color:${over?"#DC2626":"#059669"};background:${over?"#FEF2F2":"#F0FDF4"}"><div class="h-ist">${istH}</div><div class="h-soll">/${maxH}</div></td></tr>`;
    }).join("");
    const legend=[["Schicht","#0EA5E9"],["K=Krank","#FEE2E2"],["U=Urlaub","#FEF9C3"],["F=Frei","#FECACA"],["W=Arbeit","#DCFCE7"]];
    const legHtml=legend.map(([l,c])=>`<span style="background:${c};padding:1px 5px;border-radius:3px;font-size:8px;color:#374151">${l}</span>`).join(" ");
    return`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Schichtplan ${MONTHS_DE[planMonth-1]} ${planYear}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        @page{size:A4 landscape;margin:8mm 10mm}
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1E293B;background:#fff}
        table{border-collapse:collapse;width:100%;table-layout:fixed}
        th,td{border:1px solid #CBD5E1;text-align:center;vertical-align:middle;padding:2px 1px;overflow:hidden}
        th{background:#F1F5F9;font-size:9px;font-weight:600;color:#475569;height:30px}
        th.hol{background:#FEF9C3;color:#92400E}th.we{background:#FFF7ED;color:#C2410C}
        th .dn{font-weight:700;font-size:11px;line-height:1.1}
        th .dw{font-weight:400;font-size:7px;color:#94A3B8}
        .nc{background:#F1F5F9;width:${nameW}mm;min-width:${nameW}mm;max-width:${nameW}mm;text-align:left;padding:2px 4px;font-size:9px}
        .hc{width:12mm;min-width:12mm;max-width:12mm;text-align:center}
        .nm{width:${nameW}mm;min-width:${nameW}mm;max-width:${nameW}mm;text-align:left;padding:2px 4px;background:#F8FAFC;overflow:hidden}
        .nm-n{font-weight:600;font-size:9px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sh{color:#fff;border-radius:2px;font-size:9px;font-weight:700;text-align:center;padding:2px 0;line-height:1.3}
        .st{font-size:9px;font-weight:700;text-align:center;line-height:1.3}
        .st-sick{background:#FEE2E2}.st-vac{background:#FEF9C3}.st-off{background:#FECACA}.st-work{background:#DCFCE7}.st-cant{background:#FFF0E6}
        td.hol{background:#FFFDE7}td.we{background:#FFF8F1}
        .hrs{font-size:9px;font-weight:700;width:12mm;min-width:12mm;padding:1px 2px;text-align:center;line-height:1.1}
        .h-ist{font-size:10px;font-weight:700}
        .h-soll{font-size:8px;font-weight:400;color:#94A3B8}
        .hdr{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
        .hdr h2{font-size:14px;font-weight:700;color:#0F172A}
        .hdr .sub{font-size:9px;color:#64748B}
        .foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
        .leg{display:flex;gap:4px}.sig{font-size:7px;color:#94A3B8}
        @media screen{body{padding:10mm}}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
        .no-print{margin-bottom:8px;display:flex;gap:8px;align-items:center}
        @media print{.no-print{display:none}}
      </style></head><body>
      <div class="no-print">
        <button onclick="window.print()" style="padding:6px 14px;background:#0EA5E9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">Drucken / Als PDF</button>
        <span style="font-size:11px;color:#64748B">A4 Querformat</span>
      </div>
      <div class="hdr">
        <h2>Schichtplan ${MONTHS_DE[planMonth-1]} ${planYear}</h2>
        <span class="sub">${care.map(c=>c.name).join(", ")} \xb7 ${activeEmployees.length} MA \xb7 ${new Date().toLocaleDateString("de-DE")}</span>
      </div>
      <table><thead>${hdr}</thead><tbody>${rows}</tbody></table>
      <div class="foot">
        <div class="leg">${legHtml}</div>
        <span class="sig">ShiftCare \xb7 ${new Date().toLocaleString("de-DE")}</span>
      </div>
    </body></html>`;
  };

  const openPDF=()=>{
    const html=buildPDF();
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,"_blank");
    if(!win){const a=document.createElement("a");a.href=url;a.download=`Schichtplan_${planYear}-${fmt2(planMonth)}.html`;document.body.appendChild(a);a.click();document.body.removeChild(a);}
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  };

  const hasSchedule=Object.keys(schedule).length>0;

  return(
    <div>
      {/* Action bar */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {isAdmin&&<button className={`sc-btn ${showGen?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:12}} onClick={()=>setShowGen(p=>!p)}>
          {showGen?"✕ Schließen":"✨ Plan generieren"}
        </button>}
        {hasSchedule&&<button className="sc-btn sc-btn-s" style={{fontSize:12}} onClick={openPDF}>📄 PDF</button>}
      </div>
      {/* Collapsible generate panel */}
      {showGen&&isAdmin&&<div style={{marginBottom:16}}><GenerateTab {...props} onGenerate={handleGenerate}/></div>}
      {/* Schedule always visible */}
      <ScheduleTab {...props} onShowGenerate={()=>setShowGen(true)}/>
    </div>
  );
}

function AbrechnungTab(props) {
  return <PayrollTab {...props}/>;
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

// ── SETUP TAB ────────────────────────────────────────────────────

function SetupTab({employees,setEmployees,care,setCare,surcharges,setSurcharges,limits,setLimits,
  adminEmail,setAdminEmail,adminAbsence,setAdminAbsence,freistellung,setFreistellung,passwords,setPasswords,
  expandedEmp,setExpandedEmp,setConfirmDel,getMaxH,planPrefs,setPlanPrefs,
  appSettings,setAppSettings,shiftPatterns,setShiftPatterns,
  ionosCfg,setIonosCfg,backendCfg,setBackendCfg,betriebsNr,setBetriebsNr,lodasLohnarten,setLodasLohnarten,
  syncStatus,setSyncStatus,loadFromIONOS,applyData,
  emergencyContacts,setEmergencyContacts}){
  const [ionosForm,setIonosForm]=useState(ionosCfg||{bucket:"",accessKey:"",secretKey:""});
  const [ionosTest,setIonosTest]=useState(null);
  const [emEditing,setEmEditing]=useState(null);
  const [emForm,setEmForm]=useState({name:"",phone:"",note:""});
  const [setupSections,setSetupSections]=useState({admin:false,backend:false,ionos:false,datev:false,notfall:false,theme:false});
  const togSec=(k)=>setSetupSections(p=>({...p,[k]:!p[k]}));
  const emSave=()=>{
    if(!emForm.name||!emForm.phone) return;
    if(emEditing==="new") setEmergencyContacts(p=>[...p,{id:Date.now(),name:emForm.name,phone:emForm.phone,note:emForm.note}]);
    else setEmergencyContacts(p=>p.map(c=>c.id===emEditing?{...c,...emForm}:c));
    setEmEditing(null);
  }; // null|"testing"|"ok"|"error"
  const testIonos=async()=>{
    setIonosTest("testing");
    try{
      const r=await ionosS3Fetch("GET",ionosForm.bucket,ionosForm.accessKey,ionosForm.secretKey);
      setIonosTest(r.ok||r.status===404?"ok":"error");
    }catch{setIonosTest("error");}
  };
  const saveIonos=()=>{
    setIonosCfg({...ionosForm});
    setIonosTest(null);
  };
  const syncNow=async()=>{
    if(!ionosCfg?.bucket) return;
    setSyncStatus("syncing");
    const d=await loadFromIONOS(ionosCfg);
    if(d){applyData(d);setSyncStatus("synced");}else setSyncStatus("error");
  };
  const [absMonth,setAbsMonth]=useState(new Date().getMonth()+1);
  const [absYear,setAbsYear]=useState(new Date().getFullYear());
  const numD=daysInMonth(absYear,absMonth);
  const absDates=new Set(adminAbsence[absYear]?.[absMonth]||[]);
  const toggleAbs=date=>setAdminAbsence(prev=>{const yr=prev[absYear]||{};const mo=[...(yr[absMonth]||[])];const i=mo.indexOf(date);if(i>=0)mo.splice(i,1);else mo.push(date);return{...prev,[absYear]:{...yr,[absMonth]:mo}};});
  const fd=()=>{const d=new Date(absYear,absMonth-1,1).getDay();return d===0?6:d-1;};
  const cells=[];
  for(let i=0;i<fd();i++) cells.push(<div key={`e${i}`}/>);
  for(let d=1;d<=numD;d++){
    const date=fmtDate(absYear,absMonth,d),we=getWeekday(absYear,absMonth,d)>=5,isAbs=absDates.has(date);
    cells.push(<div key={d} onClick={()=>toggleAbs(date)} style={{height:30,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:isAbs?700:500,cursor:"pointer",background:isAbs?"#0F172A":we?"#F1F5F9":"#F8FAFC",color:isAbs?"#fff":we?"#CBD5E1":"#475569",border:isAbs?"2px solid #0F172A":"1px solid #E2E8F0"}}>{d}</div>);
  }
  return(
    <div className="sc-col" style={{gap:16}}>
      <div className="sc-card">
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}} onClick={()=>togSec("admin")}>
          <div className="sc-h2" style={{marginBottom:0}}>🛡️ Admin-Einstellungen</div>
          <span style={{fontSize:10,color:"var(--sc-text-3)",marginLeft:"auto"}}>{setupSections.admin?"▼":"▶"}</span>
        </div>
        {setupSections.admin&&<div className="g2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12}}>
          <div><div className="lbl">Admin-E-Mail</div><input className="sc-input" value={adminEmail} placeholder="admin@example.de" onChange={e=>setAdminEmail(e.target.value)}/></div>
          <div><div className="lbl">Max. Wunsch-Frei-Tage/Monat</div><input type="number" className="sc-input" min={0} max={20} value={limits.wishFree} onChange={e=>setLimits(p=>({...p,wishFree:Number(e.target.value)}))}/></div>
          <div><div className="lbl">Betriebsnummer (DATEV)</div><input className="sc-input" value={betriebsNr} placeholder="z.B. 12345678" onChange={e=>setBetriebsNr(e.target.value)}/></div>
        </div>}
      </div>

      {/* Backend-Server (Phase 2) */}
      <div className="sc-card">
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}} onClick={()=>togSec("backend")}>
          <div className="sc-h2" style={{marginBottom:0}}>🖥️ Backend-Server</div>
          <span style={{fontSize:10,color:"var(--sc-text-3)",marginLeft:"auto"}}>{setupSections.backend?"▼":"▶"}</span>
        </div>
        {setupSections.backend&&<Fragment>
        <div className="al al-info" style={{marginBottom:12,marginTop:10,fontSize:11}}>
          Verbinde mit deinem IONOS VPS Backend. Daten werden serverseitig gespeichert und sind geräteübergreifend verfügbar.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:12}}>
          <div><div className="lbl">Server-URL</div><input className="sc-input" style={{width:"100%"}} value={backendCfg?.url||""} placeholder="https://shiftcare.deine-domain.de" onChange={e=>setBackendCfg({...backendCfg,url:e.target.value})}/></div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}>
            <input type="checkbox" checked={backendCfg?.enabled||false} onChange={e=>setBackendCfg({...backendCfg,enabled:e.target.checked})}/> Backend-Sync aktivieren
          </label>
          {backendCfg?.enabled&&backendCfg?.url&&<button className="sc-btn sc-btn-s" style={{fontSize:11}} onClick={async()=>{
            BackendAPI.configure(backendCfg.url);
            const r=await BackendAPI._fetch("/api/health");
            if(r?.error) alert("Verbindung fehlgeschlagen: "+r.error);
            else if(r?.status==="ok") alert("Verbindung OK! Server v"+r.version+" · "+r.users+" User · "+r.tenants+" Tenant(s)");
            else alert("Unerwartete Antwort");
          }}>🔌 Verbindung testen</button>}
          {backendCfg?.enabled&&<span style={{fontSize:10,color:BackendAPI._token?"#059669":"#94A3B8"}}>{BackendAPI._token?"✓ Authentifiziert":"○ Nicht angemeldet"}</span>}
        </div>
        </Fragment>}
      </div>

      <div className="sc-card">
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}} onClick={()=>togSec("datev")}>
          <div className="sc-h2" style={{marginBottom:0}}>📊 DATEV LODAS Lohnarten</div>
          <span style={{fontSize:10,color:"var(--sc-text-3)",marginLeft:"auto"}}>{setupSections.datev?"▼":"▶"}</span>
        </div>
        {setupSections.datev&&<Fragment>
        <div className="al al-info" style={{marginBottom:12,fontSize:11}}>
          Lohnart-Nummern anpassen falls dein Steuerberater / DATEV andere Nummern verwendet.
          Standardwerte entsprechen gängigen LODAS-Lohnarten.
        </div>
        <div className="g3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[
            {k:"grundlohn",l:"Grundlohn (Stundenlohn)"},
            {k:"feiertag", l:"Feiertagszuschlag (stfr.)"},
            {k:"sonntag",  l:"Sonntagszuschlag (stfr.)"},
            {k:"nacht",    l:"Nachtzuschlag (stfr.)"},
            {k:"urlaub",   l:"Urlaubsentgelt"},
            {k:"efzg",     l:"Lohnfortzahlung Krankheit"},
          ].map(({k,l})=>(
            <div key={k}>
              <div className="lbl">{l}</div>
              <input className="sc-input" style={{width:"100%",fontFamily:"monospace"}}
                value={lodasLohnarten?.[k]||DEFAULT_LODAS_LOHNARTEN[k]}
                placeholder={DEFAULT_LODAS_LOHNARTEN[k]}
                onChange={e=>setLodasLohnarten(p=>({...p,[k]:e.target.value}))}/>
            </div>
          ))}
        </div>
        </Fragment>}
      </div>
      {/* Notfallkontakte */}
      <div className="sc-card">
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}} onClick={()=>togSec("notfall")}>
          <div className="sc-h2" style={{marginBottom:0}}>🚨 Notfallkontakte</div>
          <span style={{fontSize:10,color:"var(--sc-text-3)",marginLeft:"auto"}}>{setupSections.notfall?"▼":"▶"}</span>
        </div>
        {setupSections.notfall&&<Fragment>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button className="sc-btn sc-btn-p" style={{fontSize:11}} onClick={()=>{setEmForm({name:"",phone:"",note:""});setEmEditing("new");}}>+ Hinzufügen</button>
        </div>
        <div className="al al-info" style={{marginBottom:14,fontSize:11}}>Werden in der Kopfleiste für alle Mitarbeiter angezeigt. Im Notfall bitte zuerst 112 anrufen.</div>
        {emergencyContacts.length===0&&<div style={{textAlign:"center",padding:16,color:"var(--sc-text-3)",fontSize:12}}>Keine Einträge.</div>}
        {emergencyContacts.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--sc-subtle)",borderRadius:8,border:"1px solid var(--sc-border)",marginBottom:6,flexWrap:"wrap"}}>
            <span style={{fontSize:16}}>📞</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:12}}>{c.name}</div>
              <span style={{fontSize:12,fontWeight:700,color:"var(--sc-accent)",fontFamily:"'JetBrains Mono',monospace"}}>{c.phone}</span>
              {c.note&&<span style={{fontSize:10,color:"var(--sc-text-3)",marginLeft:8}}>{c.note}</span>}
            </div>
            <button className="sc-btn sc-btn-s" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>{setEmForm({name:c.name,phone:c.phone,note:c.note||""});setEmEditing(c.id);}}>✏️</button>
            <button onClick={()=>setEmergencyContacts(p=>p.filter(x=>x.id!==c.id))} style={{background:"transparent",border:"1px solid #FECACA",borderRadius:6,cursor:"pointer",color:"var(--sc-red)",fontSize:12,padding:"3px 7px"}}>✕</button>
          </div>
        ))}
        </Fragment>}
      </div>
      {emEditing&&(
        <div className="dlg-overlay" onClick={()=>setEmEditing(null)}>
          <div className="dlg" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>{emEditing==="new"?"Neuer Kontakt":"Kontakt bearbeiten"}</div>
            <div className="sc-col" style={{gap:10}}>
              <div><div className="lbl">Name / Funktion</div><input className="sc-input" value={emForm.name} placeholder="z.B. Notaufnahme Diakonie" onChange={e=>setEmForm(p=>({...p,name:e.target.value}))}/></div>
              <div><div className="lbl">Telefonnummer</div><input className="sc-input" value={emForm.phone} placeholder="0711 / ..." onChange={e=>setEmForm(p=>({...p,phone:e.target.value}))}/></div>
              <div><div className="lbl">Hinweis (optional)</div><input className="sc-input" value={emForm.note} placeholder="z.B. Mo–Fr 8–18 Uhr" onChange={e=>setEmForm(p=>({...p,note:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="sc-btn sc-btn-s" onClick={()=>setEmEditing(null)}>Abbrechen</button>
              <button className="sc-btn sc-btn-g" onClick={emSave} disabled={!emForm.name||!emForm.phone}>Speichern</button>
            </div>
          </div>
        </div>
      )}
      <div className="sc-grid2">
        {/* Mitarbeiter */}
        <div className="sc-card">
          <div className="sc-row" style={{marginBottom:14}}>
            <div className="sc-h2" style={{marginBottom:0}}>👥 Mitarbeiter</div>
            <button className="sc-btn sc-btn-p" style={{marginLeft:"auto",fontSize:11}} onClick={()=>{const id=Math.max(0,...employees.map(e=>e.id))+1;setEmployees(p=>[...p,{id,name:"Neue/r MA",pensumPct:100,color:PALETTE[id%PALETTE.length],customMaxH:null,vacationDaysOverride:null,hourlyRate:14.00,contractNote:"",preferredWeekdays:[],email:""}]);setPasswords(p=>({...p,[id]:btoa("0000")}));}}>+ Hinzufügen</button>
          </div>
          <div className="sc-col">
            {employees.map(emp=>(
              <div key={emp.id} className="emp-card">
                <div className="emp-card-head" onClick={()=>setExpandedEmp(expandedEmp===emp.id?null:emp.id)}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:emp.color,flexShrink:0}}/>
                  <input className="sc-input" value={emp.name} style={{flex:1}} onClick={e=>e.stopPropagation()}
                    onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,name:e.target.value}:x))}/>
                  {emp.probationEnd&&emp.probationEnd>=today()&&<span style={{fontSize:9,background:"#FFFBEB",color:"#92400E",border:"1px solid #FDE68A",borderRadius:4,padding:"2px 5px",flexShrink:0}}>⏳ Probe</span>}
                  <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    <input type="number" className="sc-input" value={emp.pensumPct} min={1} max={100} style={{width:56,textAlign:"center"}}
                      onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,pensumPct:Number(e.target.value)}:x))}/>
                    <span style={{fontSize:11,color:"#94A3B8"}}>%</span>
                  </div>
                  <span style={{fontSize:12,color:"#94A3B8"}}>{expandedEmp===emp.id?"▲":"▼"}</span>
                  <button onClick={e=>{e.stopPropagation();setConfirmDel(emp);}} style={{background:"transparent",border:"1px solid #FECACA",borderRadius:6,cursor:"pointer",color:"#EF4444",fontSize:13,padding:"3px 7px"}}>🗑</button>
                </div>
                {expandedEmp===emp.id&&(
                  <div className="emp-card-body">
                    <div><div className="lbl">E-Mail</div><input className="sc-input" value={emp.email||""} placeholder="ma@example.de" onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,email:e.target.value}:x))}/></div>
                    <div><div className="lbl">Personalnummer (DATEV)</div><input className="sc-input" value={emp.personalNr||""} placeholder={String(emp.id).padStart(5,"0")} onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,personalNr:e.target.value}:x))}/></div>
                    <div><div className="lbl">Telefon</div><input className="sc-input" value={emp.phone||""} placeholder="+49 170 ..." onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,phone:e.target.value}:x))}/></div>
                    <div><div className="lbl">Stundensatz (€/h)</div><input type="number" className="sc-input" step="0.01" min="0" value={emp.hourlyRate||""} onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,hourlyRate:parseFloat(e.target.value)||0}:x))}/></div>
                    <div>
                      <div className="lbl">Probezeit bis</div>
                      <input type="date" className="sc-input" value={emp.probationEnd||""} onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,probationEnd:e.target.value}:x))}/>
                      {emp.probationEnd&&emp.probationEnd>=today()&&<div style={{fontSize:10,color:"#F59E0B",marginTop:3}}>⏳ In Probezeit bis {emp.probationEnd}</div>}
                      {emp.probationEnd&&emp.probationEnd<today()&&<div style={{fontSize:10,color:"#10B981",marginTop:3}}>✓ Probezeit abgeschlossen</div>}
                    </div>
                    <div><div className="lbl">Soll-Stunden/Monat (leer=Auto)</div><input type="number" className="sc-input" value={emp.customMaxH||""} placeholder={`Auto: ${Math.round((emp.pensumPct??100)/100*160)}h`} onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,customMaxH:e.target.value?Number(e.target.value):null}:x))}/></div>
                    <div><div className="lbl">Jahresurlaub (leer=Auto)</div><input type="number" className="sc-input" value={emp.vacationDaysOverride||""} placeholder={`Auto: ${calcVacationDays(emp)} Tage`} onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,vacationDaysOverride:e.target.value?Number(e.target.value):null}:x))}/></div>
                    <div><div className="lbl">Urlaub: Std/Tag (für Abrechnung)</div><input type="number" className="sc-input" step="0.5" min={1} max={24} value={emp.dailyContractHours??8} placeholder="z.B. 8" onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,dailyContractHours:parseFloat(e.target.value)||8}:x))}/></div>
                    <div style={{gridColumn:"1/-1"}}><div className="lbl">Vertragsnotiz</div><input className="sc-input" value={emp.contractNote||""} onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,contractNote:e.target.value}:x))}/></div>
                    <div style={{gridColumn:"1/-1"}}>
                      <div className="lbl" style={{marginBottom:6}}>Bevorzugte Schichtlänge (Stunden, Soft)</div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <input type="number" className="sc-input" style={{width:80}} min={0} max={120} placeholder="–"
                          value={emp.preferredShiftH||""} onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,preferredShiftH:e.target.value?Number(e.target.value):null}:x))}/>
                        <span style={{fontSize:11,color:"var(--sc-text-3)"}}>h</span>
                        {emp.preferredShiftH&&<button className="sc-btn sc-btn-s" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,preferredShiftH:null}:x))}>✕ Zurücksetzen</button>}
                      </div>
                      {emp.preferredShiftH&&<div style={{fontSize:10,color:"var(--sc-text-3)",marginTop:3}}>Algorithmus bevorzugt {emp.preferredShiftH}h-Blöcke, weicht bei Bedarf ab.</div>}
                    </div>
                    <div style={{gridColumn:"1/-1"}}>
                      <div className="lbl" style={{marginBottom:8}}>Bevorzugte Wochentage (weich)</div>
                      <div className="wd-row">{DAYS_SHORT.map((d,i)=>{const on=(emp.preferredWeekdays||[]).includes(i);return(<button key={i} className="wd-btn" style={on?{background:emp.color,color:"#fff",border:`1px solid ${emp.color}`,fontWeight:700}:{}} onClick={()=>setEmployees(p=>p.map(x=>{if(x.id!==emp.id) return x;const wd=x.preferredWeekdays||[];return{...x,preferredWeekdays:wd.includes(i)?wd.filter(w=>w!==i):[...wd,i].sort()};}))}>{d}</button>);})}</div>
                    </div>
                    <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:10,background:"#FFF7ED",borderRadius:8,padding:"8px 12px",border:"1px solid #FED7AA"}}>
                      <input type="checkbox" id={`no24h_${emp.id}`} checked={emp.no24hShift||false}
                        onChange={e=>setEmployees(p=>p.map(x=>x.id===emp.id?{...x,no24hShift:e.target.checked}:x))}
                        style={{width:16,height:16,cursor:"pointer",accentColor:"#F97316"}}/>
                      <label htmlFor={`no24h_${emp.id}`} style={{fontSize:12,fontWeight:600,cursor:"pointer",color:"#C2410C"}}>
                        🔁 Niemals allein – nur 2×/3× 24h hintereinander, nie eine einzelne 24h-Schicht
                      </label>
                    </div>
                    <div style={{gridColumn:"1/-1",background:"#F0FDF4",borderRadius:8,padding:"8px 12px",fontSize:11}}>
                      <strong style={{color:"#059669"}}>Pensum {emp.pensumPct}%</strong> · {getMaxH(emp)}h/Mo · Urlaub: {calcVacationDays(emp)} Tage/Jahr · €{(emp.hourlyRate||0).toFixed(2)}/h
                    </div>
                    <div style={{gridColumn:"1/-1"}}><div className="pensum-bar"><div className="pensum-fill" style={{width:`${emp.pensumPct}%`}}/></div></div>
                    {/* Freistellungen */}
                    <div style={{gridColumn:"1/-1"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div className="lbl" style={{marginBottom:0}}>Freistellungen</div>
                        <button className="sc-btn sc-btn-s" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>{const nf={id:Date.now(),type:"unpaid",startDate:today(),endDate:"",note:""};setFreistellung(p=>({...p,[emp.id]:[...(p[emp.id]||[]),nf]}));}}>+ Hinzufügen</button>
                      </div>
                      {(freistellung[emp.id]||[]).map(f=>(
                        <div key={f.id} style={{background:"#F8FAFC",borderRadius:8,padding:10,border:"1px solid #E2E8F0",marginBottom:6}}>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                            <select className="sc-sel" value={f.type} style={{flex:1,minWidth:140}} onChange={e=>setFreistellung(p=>({...p,[emp.id]:(p[emp.id]||[]).map(x=>x.id===f.id?{...x,type:e.target.value}:x)}))}>
                              {Object.entries(FREISTELLUNG_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <input type="date" className="sc-input" value={f.startDate} style={{width:130}} onChange={e=>setFreistellung(p=>({...p,[emp.id]:(p[emp.id]||[]).map(x=>x.id===f.id?{...x,startDate:e.target.value}:x)}))}/>
                            <span style={{fontSize:11,color:"#94A3B8",alignSelf:"center"}}>bis</span>
                            <input type="date" className="sc-input" value={f.endDate||""} style={{width:130}} onChange={e=>setFreistellung(p=>({...p,[emp.id]:(p[emp.id]||[]).map(x=>x.id===f.id?{...x,endDate:e.target.value}:x)}))}/>
                            <button onClick={()=>setFreistellung(p=>({...p,[emp.id]:(p[emp.id]||[]).filter(x=>x.id!==f.id)}))} style={{background:"transparent",border:"none",cursor:"pointer",color:"#EF4444",fontSize:16}}>×</button>
                          </div>
                          <input className="sc-input" value={f.note||""} placeholder="Notiz" onChange={e=>setFreistellung(p=>({...p,[emp.id]:(p[emp.id]||[]).map(x=>x.id===f.id?{...x,note:e.target.value}:x)}))}/>
                          <div style={{marginTop:6}}><span className="frst-badge" style={{background:FREISTELLUNG_TYPES[f.type].badge,color:FREISTELLUNG_TYPES[f.type].badgeT}}>{FREISTELLUNG_TYPES[f.type].label}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Rechte Spalte */}
        <div className="sc-col" style={{gap:16}}>
          {/* Arbeitgeber (ehem. Pflegebedürftige) */}
          <div className="sc-card">
            <div className="sc-row" style={{marginBottom:14}}>
              <div className="sc-h2" style={{marginBottom:0}}>🏠 Arbeitgeber</div>
              <button className="sc-btn sc-btn-p" style={{marginLeft:"auto",fontSize:11}} onClick={()=>{const id=Math.max(0,...care.map(c=>c.id))+1;setCare(p=>[...p,{id,name:"Neuer Arbeitgeber",notes:"",bundesland:"BW",shiftDurationH:24,shiftStartHour:8,shiftStartsEve:false,maxConsecutiveShifts:3,minRestBetweenBlocksH:24,fullCoverage:true}]);}}>+ Hinzufügen</button>
            </div>
            {care.map(c=>(
              <div key={c.id} style={{background:"#F8FAFC",borderRadius:10,padding:14,border:"1px solid #E2E8F0",marginBottom:8}}>
                <div className="sc-row" style={{marginBottom:8}}>
                  <input className="sc-input" value={c.name} style={{flex:1}} onChange={e=>setCare(p=>p.map(x=>x.id===c.id?{...x,name:e.target.value}:x))}/>
                  <button onClick={()=>setCare(p=>p.filter(x=>x.id!==c.id))} style={{background:"transparent",border:"none",cursor:"pointer",color:"#CBD5E1",fontSize:18}}>×</button>
                </div>
                <input className="sc-input" value={c.notes||""} placeholder="Notizen" style={{marginBottom:8}} onChange={e=>setCare(p=>p.map(x=>x.id===c.id?{...x,notes:e.target.value}:x))}/>
                <div className="g2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <div className="lbl">Bundesland (Feiertage)</div>
                    <select className="sc-sel" style={{width:"100%"}} value={c.bundesland||"BW"} onChange={e=>setCare(p=>p.map(x=>x.id===c.id?{...x,bundesland:e.target.value}:x))}>
                      {Object.entries(BUNDESLAENDER).map(([k,v])=><option key={k} value={k}>{k} – {v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="lbl">Schichtlänge (Stunden)</div>
                    <input type="number" className="sc-input" min={1} max={72} value={c.shiftDurationH} onChange={e=>setCare(p=>p.map(x=>x.id===c.id?{...x,shiftDurationH:Number(e.target.value)}:x))}/>
                  </div>
                  <div>
                    <div className="lbl">Schichtbeginn</div>
                    <select className="sc-sel" style={{width:"100%"}} value={c.shiftStartHour} onChange={e=>setCare(p=>p.map(x=>x.id===c.id?{...x,shiftStartHour:Number(e.target.value)}:x))}>
                      {Array.from({length:24},(_,h)=>h).map(h=><option key={h} value={h}>{fmt2(h)}:00</option>)}
                    </select>
                    <div style={{display:"flex",gap:4,marginTop:6}}>
                      <button className={`sc-btn ${!c.shiftStartsEve?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:10,flex:1,padding:"4px 6px"}}
                        onClick={()=>setCare(p=>p.map(x=>x.id===c.id?{...x,shiftStartsEve:false}:x))}>Am Plantag</button>
                      <button className={`sc-btn ${c.shiftStartsEve?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:10,flex:1,padding:"4px 6px"}}
                        onClick={()=>setCare(p=>p.map(x=>x.id===c.id?{...x,shiftStartsEve:true}:x))}>Am Vorabend</button>
                    </div>
                    {c.shiftStartsEve&&<div style={{fontSize:9,color:"var(--sc-text-3)",marginTop:4}}>Schicht für z.B. Samstag startet Freitagabend um {fmt2(c.shiftStartHour)}:00</div>}
                  </div>
                  <div>
                    <div className="lbl">Max. aufeinanderfolgend</div>
                    <input type="number" className="sc-input" min={1} max={10} value={c.maxConsecutiveShifts} onChange={e=>setCare(p=>p.map(x=>x.id===c.id?{...x,maxConsecutiveShifts:Number(e.target.value)}:x))}/>
                  </div>
                  <div style={{gridColumn:"1/-1"}}>
                    <div className="lbl" style={{marginBottom:4}}>24h-Abdeckung</div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <button className={`sc-btn ${c.fullCoverage!==false?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:11,flex:1}} onClick={()=>setCare(p=>p.map(x=>x.id===c.id?{...x,fullCoverage:true}:x))}>Ja – alle 24h müssen abgedeckt sein</button>
                      <button className={`sc-btn ${c.fullCoverage===false?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:11,flex:1}} onClick={()=>setCare(p=>p.map(x=>x.id===c.id?{...x,fullCoverage:false}:x))}>Nein – nur geplante Schichten</button>
                    </div>
                    {c.fullCoverage!==false&&<div style={{fontSize:10,color:"var(--sc-text-3)",marginTop:4}}>Bei {c.shiftDurationH}h-Schichten: {Math.ceil(24/c.shiftDurationH)} Schicht(en) pro Tag</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Admin-Abwesenheit */}
          <div className="sc-card">
            <div className="sc-h2">🏡 Meine Abwesenheiten (Keine Assistenz nötig)</div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
              <select className="sc-sel" value={absMonth} onChange={e=>setAbsMonth(Number(e.target.value))} style={{width:120}}>{MONTHS_DE.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>
              <input type="number" className="sc-input" value={absYear} min={2024} max={2035} style={{width:72}} onChange={e=>setAbsYear(Number(e.target.value))}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#94A3B8",padding:"3px 0"}}>{d}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{cells}</div>
            {absDates.size>0&&<div style={{fontSize:11,color:"#64748B",marginTop:8}}>{absDates.size} Abwesenheitstag(e) eingetragen.</div>}
          </div>
          {/* Zuschläge */}
          <div className="sc-card">
            <div className="sc-h2">💰 Zuschlagssätze (§3b EStG)</div>
            <div className="g3" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[{l:"🎉 Feiertag",k:"holiday",c:"#F59E0B",note:"Bis 125% steuerfrei"},{l:"☀️ Sonntag",k:"sunday",c:"#0EA5E9",note:"Bis 50% steuerfrei"},{l:"🌙 Nacht",k:"night",c:"#8B5CF6",note:"Bis 25% steuerfrei"}].map(({l,k,c,note})=>(
                <div key={k} className="sc-box" style={{borderLeftColor:c}}>
                  <div className="lbl" style={{marginBottom:8}}>{l}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <input type="number" className="pct-inp" style={{color:c}} value={surcharges[k]} onChange={e=>setSurcharges(p=>({...p,[k]:Number(e.target.value)}))}/>
                    <span style={{fontSize:16,fontWeight:700,color:"#94A3B8"}}>%</span>
                  </div>
                  <div style={{fontSize:10,color:"#94A3B8"}}>{note}</div>
                  {k==="night"&&<div style={{display:"flex",gap:6,alignItems:"center",marginTop:8}}>
                    <select className="sc-sel" style={{flex:1,fontSize:10}} value={surcharges.nightStart} onChange={e=>setSurcharges(p=>({...p,nightStart:Number(e.target.value)}))}>
                      {[18,19,20,21,22,23,0].map(h=><option key={h} value={h}>{fmt2(h)}:00</option>)}
                    </select>
                    <span style={{fontSize:10,color:"#94A3B8"}}>–</span>
                    <select className="sc-sel" style={{flex:1,fontSize:10}} value={surcharges.nightEnd} onChange={e=>setSurcharges(p=>({...p,nightEnd:Number(e.target.value)}))}>
                      {[4,5,6,7,8].map(h=><option key={h} value={h}>{fmt2(h)}:00</option>)}
                    </select>
                  </div>}
                </div>
              ))}
            </div>
            <div className="al al-info" style={{marginTop:10,fontSize:11}}>
              Feiertagszuschlag gilt nur für die Stunden, die tatsächlich auf einen gesetzlichen Feiertag fallen. Bundesland wird pro Arbeitgeber gesetzt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PREFS TAB ─────────────────────────────────────────────────────

function PrefsTab({employees,care,isAdmin,myEmp,planYear,planMonth,
  limits,getEmpP,getEmpC,toggleEmpP,toggleEmpC,getCareP,setCareAssist,defaultHolidayMap,defaultHolidaySet}){
  const numD=daysInMonth(planYear,planMonth);
  const hMap=useMemo(()=>getHolidaysByBL(planYear,"BW"),[planYear]);
  const hSet=useMemo(()=>new Set(Object.keys(hMap)),[hMap]);

  const renderEmpCard=(emp)=>(
    <EmpWishCard key={emp.id} emp={emp} year={planYear} month={planMonth} numDays={numD}
      prefs={getEmpP(emp.id,planYear,planMonth)} constraints={getEmpC(emp.id,planYear,planMonth)}
      onTogglePref={(d,m)=>toggleEmpP(emp.id,d,m,planYear,planMonth)}
      onToggleConstraint={(d,m)=>toggleEmpC(emp.id,d,m,planYear,planMonth)}
      freeLimit={limits.wishFree} holidaySet={hSet} holidayMap={hMap}/>
  );

  return(
    <div className="sc-col" style={{gap:16}}>
      <div className="sc-card" style={{padding:"12px 18px"}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:13,fontWeight:700}}>Wünsche & Verfügbarkeit für {MONTHS_DE[planMonth-1]} {planYear}</span>
          <div className="al al-info" style={{padding:"4px 12px",marginBottom:0,fontSize:11,marginLeft:"auto"}}>Monat über die Kopfleiste wechseln</div>
        </div>
      </div>
      {isAdmin&&(
        <>
          <div>
            <div style={{fontWeight:700,fontSize:13,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
              Assistenzwünsche Arbeitgeber
              <span className="al al-pur" style={{padding:"2px 10px",marginBottom:0,fontSize:10}}>Bindend · Höchste Priorität</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12,marginBottom:20}}>
              {care.map(c=><CareAssistCard key={c.id} care={c} employees={employees} year={planYear} month={planMonth} numDays={numD}
                carePrefs={getCareP(c.id,planYear,planMonth)} onSet={(d,eId)=>setCareAssist(c.id,d,eId,planYear,planMonth)}
                holidaySet={hSet} holidayMap={hMap}/>)}
            </div>
            <hr className="sc-div"/>
            <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>Mitarbeiterwünsche & Verfügbarkeit</div>
            <div className="al al-or" style={{marginBottom:12,fontSize:11}}>
              ✅ <strong>Kann-Tage = hartes Kriterium</strong> – nur an markierten Tagen einplanbar. Ohne Kann-Markierung: alle Tage verfügbar (außer Urlaub/Krank).
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {employees.map(emp=>renderEmpCard(emp))}
            </div>
          </div>
        </>
      )}
      {!isAdmin&&myEmp&&(
        <div style={{maxWidth:400}}>{renderEmpCard(myEmp)}</div>
      )}
    </div>
  );
}

// ── EMP WISH CARD ──────────────────────────────────────────────────

function EmpWishCard({emp,year,month,numDays,prefs,constraints,onTogglePref,onToggleConstraint,freeLimit,holidaySet,holidayMap}){
  const [mode,setMode]=useState("wishOff");
  const empLimit=freeLimit??3;
  const freeCount=prefs.wishOff?.size||0,over=freeCount>=empLimit;
  const fd=()=>{const d=new Date(year,month-1,1).getDay();return d===0?6:d-1;};
  const cells=[];
  for(let i=0;i<fd();i++) cells.push(<div key={`e${i}`}/>);
  for(let d=1;d<=numDays;d++){
    const date=fmtDate(year,month,d),we=getWeekday(year,month,d)>=5,hol=holidaySet?.has(date);
    const isOff=prefs.wishOff?.has(date),isWork=prefs.wishWork?.has(date);
    const isCanWork=constraints?.canDates?.has(date);
    let cls="cal-day",bg="",border="";
    if(isCanWork){bg="#DCFCE7";border="2px solid #16A34A";}
    else if(isOff) cls="cal-day off";
    else if(isWork) cls="cal-day work";
    else if(hol) cls="cal-day hol";
    else if(we) cls="cal-day wknd";
    const color=isCanWork?"#15803D":undefined;
    const txt=isCanWork?"✓":d;
    cells.push(
      <div key={d} className={cls} style={bg?{background:bg,border,color,fontWeight:700}:{}}
        title={hol?(holidayMap?.[date]||"Feiertag"):isCanWork?"Kann arbeiten":""}
        onClick={()=>{
          if(mode==="wishOff"&&!isOff&&over) return;
          if(mode==="canDates") onToggleConstraint(date,"canDates");
          else onTogglePref(date,mode);
        }}>
        {txt}{hol&&!isOff&&!isWork&&!isCanWork&&<span style={{position:"absolute",top:1,right:2,fontSize:7}}>🎉</span>}
      </div>
    );
  }
  // Nur 3 Modi: Wunsch-Frei, Wunsch-Arbeit, Kann (Verfügbarkeit hart)
  const MODES=[
    {id:"wishOff",l:"🔴 Wunsch-Frei",cls:"sc-btn-r"},
    {id:"wishWork",l:"🟢 Wunsch-Arbeit",cls:"sc-btn-g"},
    {id:"canDates",l:"✅ Kann",cls:"sc-btn-g"},
  ];
  return(
    <div className="sc-card">
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:emp.color}}/>
        <div style={{fontWeight:700,fontSize:12}}>{emp.name}</div>
        <span style={{fontSize:10,color:"#94A3B8",marginLeft:"auto"}}>{emp.pensumPct}%</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:8}}>
        {MODES.map(({id,l,cls})=>(
          <button key={id} className={`sc-btn ${mode===id?cls:"sc-btn-s"}`}
            style={{fontSize:9,padding:"4px 3px"}} onClick={()=>setMode(id)}>{l}</button>
        ))}
      </div>
      {mode==="canDates"&&<div className="al al-ok" style={{marginBottom:8,fontSize:10,padding:"4px 10px"}}>✅ Hartes Kriterium – nur an markierten Tagen einplanbar</div>}
      {mode==="wishOff"&&over&&<div className="al al-warn" style={{marginBottom:8,fontSize:11}}>Limit: max. {empLimit} Wunsch-Frei/Monat</div>}
      <div className="cal-hdr">{DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#94A3B8",padding:"3px 0"}}>{d}</div>)}</div>
      <div className="cal-grid">{cells}</div>
      <hr style={{border:"none",borderTop:"1px solid #F1F5F9",margin:"10px 0"}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
        {[{bg:"#FEF2F2",v:freeCount,max:empLimit,c:"#DC2626",l:"Wunsch-Frei"},
          {bg:"#F0FDF4",v:prefs.wishWork?.size||0,c:"#059669",l:"Wunsch-Arbeit"},
          {bg:"#DCFCE7",v:constraints?.canDates?.size||0,c:"#15803D",l:"✅ Kann-Tage"},
        ].map((item,i)=>(
          <div key={i} style={{background:item.bg,borderRadius:8,padding:"6px 10px",textAlign:"center"}}>
            <div style={{fontSize:14,fontWeight:700,color:item.c}}>{item.v}{item.max&&<span style={{fontSize:9,fontWeight:400,color:"#94A3B8"}}>/{item.max}</span>}</div>
            <div style={{fontSize:9,color:"#94A3B8"}}>{item.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CARE ASSIST CARD ───────────────────────────────────────────────

function CareAssistCard({care,employees,year,month,numDays,carePrefs,onSet,holidaySet,holidayMap}){
  const [selEmp,setSelEmp]=useState(employees[0]?.id||null);
  const fd=()=>{const d=new Date(year,month-1,1).getDay();return d===0?6:d-1;};
  const cells=[];
  for(let i=0;i<fd();i++) cells.push(<div key={`e${i}`}/>);
  for(let d=1;d<=numDays;d++){
    const date=fmtDate(year,month,d),we=getWeekday(year,month,d)>=5,hol=holidaySet?.has(date);
    const aEmpId=carePrefs[date],aEmp=employees.find(e=>e.id===aEmpId);
    cells.push(
      <div key={d} onClick={()=>onSet(date,selEmp)} style={{height:30,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,cursor:"pointer",transition:"all .1s",position:"relative",background:aEmp?aEmp.color:hol?"#FDE68A":we?"#F1F5F9":"#F8FAFC",color:aEmp?"#fff":hol?"#92400E":we?"#CBD5E1":"#475569",border:aEmp?`2px solid ${aEmp.color}`:"1px solid #E2E8F0",overflow:"hidden",padding:"0 2px"}}>
        {aEmp?aEmp.name.split(" ")[0]:d}{hol&&!aEmp&&<span style={{position:"absolute",top:1,right:2,fontSize:7}}>🎉</span>}
      </div>
    );
  }
  return(
    <div className="sc-card">
      <div style={{fontWeight:700,fontSize:12,marginBottom:6}}>🏠 {care.name}</div>
      {care.notes&&<div style={{fontSize:10,color:"#64748B",marginBottom:10}}>{care.notes}</div>}
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
        {employees.map(emp=>(
          <button key={emp.id} onClick={()=>setSelEmp(emp.id)}
            style={{padding:"4px 8px",borderRadius:6,border:`2px solid ${selEmp===emp.id?emp.color:"#E2E8F0"}`,background:selEmp===emp.id?emp.color:"#F8FAFC",color:selEmp===emp.id?"#fff":"#475569",cursor:"pointer",fontSize:10,fontWeight:600,transition:"all .15s"}}>
            {emp.name.split(" ")[0]}
          </button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#94A3B8",padding:"3px 0"}}>{d}</div>)}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{cells}</div>
      <div style={{fontSize:10,color:"#64748B",marginTop:8}}><strong>{Object.keys(carePrefs).length}</strong> Assistenzwünsche</div>
    </div>
  );
}

// ── VACATION TAB ──────────────────────────────────────────────────

function VacationTab({employees,isAdmin,myEmp,planYear,planMonth,defaultHolidaySet,defaultHolidayMap,vacReqs,getVacUsed,submitVac,updateVac,calcVacationDays}){
  const [editReq,setEditReq]=useState(null);

  const renderEmpPanel=(emp)=>{
    const [sel,setSel]=useState(new Set());
    const vacLimit=calcVacationDays(emp),usedDays=getVacUsed(emp.id,planYear),remaining=vacLimit-usedDays;
    const allReqs=Object.entries(vacReqs[emp.id]||{}).flatMap(([yr,reqs])=>reqs.map(r=>({...r,year:Number(yr)})));
    const approved=new Set(allReqs.filter(r=>r.status==="approved").flatMap(r=>r.adminDates||r.dates));
    const pending=new Set(allReqs.filter(r=>r.status==="pending").flatMap(r=>r.adminDates||r.dates));
    const numD=daysInMonth(planYear,planMonth);
    const hMap=getHolidaysByBL(planYear,"BW");const hSet=new Set(Object.keys(hMap));
    const fd=()=>{const d=new Date(planYear,planMonth-1,1).getDay();return d===0?6:d-1;};
    const cells=[];
    for(let i=0;i<fd();i++) cells.push(<div key={`e${i}`}/>);
    for(let d=1;d<=numD;d++){
      const date=fmtDate(planYear,planMonth,d),we=getWeekday(planYear,planMonth,d)>=5,hol=hSet.has(date);
      const isA=approved.has(date),isP=pending.has(date),isSel=sel.has(date);
      cells.push(
        <div key={d} onClick={isA||isP?null:()=>setSel(p=>{const n=new Set(p);n.has(date)?n.delete(date):n.add(date);return n;})}
          style={{height:32,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,cursor:isA||isP?"default":"pointer",background:isA?"#D1FAE5":isP?"#FEF9C3":isSel?"#BFDBFE":hol?"#FDE68A":we?"#F1F5F9":"#F8FAFC",color:isA?"#065F46":isP?"#92400E":isSel?"#1D4ED8":hol?"#92400E":we?"#CBD5E1":"#475569",border:isSel?"2px solid #3B82F6":isA?"2px solid #10B981":isP?"2px solid #F59E0B":"1px solid #E2E8F0",position:"relative"}}>
          {isA?"✓":isP?"⏳":d}{hol&&!isA&&!isP&&!isSel&&<span style={{position:"absolute",top:1,right:2,fontSize:7}}>🎉</span>}
        </div>
      );
    }
    return(
      <div className="sc-card" style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:emp.color}}/>
          <div style={{fontWeight:700,fontSize:13}}>{emp.name}</div>
          <div className={`sc-badge ${remaining>0?"al-ok":"al-err"}`} style={{marginLeft:"auto"}}>{usedDays}/{vacLimit} · {remaining} verbleibend</div>
        </div>
        <div style={{fontSize:11,color:"var(--sc-text-3)",marginBottom:8}}>{MONTHS_DE[planMonth-1]} {planYear}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#94A3B8"}}>{d}</div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{cells}</div>
        <hr className="sc-div"/>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#64748B"}}>{sel.size} Tag(e) gewählt</span>
          <button className="sc-btn sc-btn-p" style={{marginLeft:"auto"}} disabled={sel.size===0||sel.size>remaining}
            onClick={()=>{submitVac(emp.id,planYear,[...sel].sort());setSel(new Set());}}>
            🏖️ Urlaub beantragen
          </button>
        </div>
        {sel.size>remaining&&<div className="al al-err" style={{marginTop:8,fontSize:11}}>Nicht genug verbleibende Urlaubstage ({remaining}).</div>}
      </div>
    );
  };

  if(isAdmin) return(
    <div className="sc-col" style={{gap:16}}>
      {/* Admin Edit Dialog */}
      {editReq&&(
        <div className="dlg-overlay" onClick={()=>setEditReq(null)}>
          <div className="dlg" onClick={e=>e.stopPropagation()} style={{maxWidth:480}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>✏️ Urlaubsantrag bearbeiten</div>
            <div style={{fontSize:12,color:"#64748B",marginBottom:14}}>
              {employees.find(e=>e.id===editReq.empId)?.name} · {editReq.year}
            </div>
            <div className="lbl" style={{marginBottom:8}}>Tage (klicken zum Abwählen/Hinzufügen)</div>
            <VacDateEditor editReq={editReq} setEditReq={setEditReq}/>
            <div className="lbl" style={{marginTop:12,marginBottom:4}}>Kommentar für Mitarbeiter</div>
            <input className="sc-input" value={editReq.comment||""} placeholder="z.B. Mo–Fr genehmigt, Sa–So abgelehnt" onChange={e=>setEditReq(p=>({...p,comment:e.target.value}))}/>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end",flexWrap:"wrap"}}>
              <button className="sc-btn sc-btn-s" onClick={()=>setEditReq(null)}>Abbrechen</button>
              <button className="sc-btn sc-btn-r" onClick={()=>{updateVac(editReq.empId,editReq.year,editReq.reqId,"rejected",editReq.dates,editReq.comment);setEditReq(null);}}>❌ Ablehnen</button>
              <button className="sc-btn sc-btn-g" onClick={()=>{updateVac(editReq.empId,editReq.year,editReq.reqId,"approved",editReq.dates,editReq.comment);setEditReq(null);}}>✅ Genehmigen</button>
            </div>
          </div>
        </div>
      )}
      <div className="sc-card">
        <div className="sc-h2">🏖️ Urlaubsanträge – Übersicht</div>
        {employees.map(emp=>{
          const allReqs=Object.entries(vacReqs[emp.id]||{}).flatMap(([yr,reqs])=>reqs.map(r=>({...r,year:Number(yr)})));
          const used=getVacUsed(emp.id,planYear),limit=calcVacationDays(emp);
          return(
            <div key={emp.id} style={{marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:emp.color}}/>
                <span style={{fontWeight:700}}>{emp.name}</span>
                <span className="al al-ok" style={{padding:"2px 10px",marginBottom:0,fontSize:10,marginLeft:"auto"}}>{used}/{limit} Tage {planYear}</span>
              </div>
              {allReqs.length===0?<div style={{fontSize:12,color:"#94A3B8",fontStyle:"italic",paddingLeft:18}}>Keine Anträge.</div>:(
                <div className="sc-col" style={{gap:5}}>
                  {allReqs.map(req=>{
                    const effDates=req.adminDates||req.dates;
                    const overlapping=employees.filter(other=>{if(other.id===emp.id) return false;const od=(vacReqs[other.id]?.[req.year]||[]).filter(r=>r.status!=="rejected").flatMap(r=>r.adminDates||r.dates);return req.dates.some(d=>od.includes(d));});
                    return(
                      <div key={req.id} className={`vac-req ${req.status}`}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:700}}>{effDates.length} Tag(e) · {req.year}</div>
                          <div style={{fontSize:10,color:"#64748B",marginTop:2}}>{effDates.slice(0,5).join(" · ")}{effDates.length>5&&` +${effDates.length-5} weitere`}</div>
                          {req.adminComment&&<div style={{fontSize:10,color:"#0EA5E9",marginTop:2}}>💬 {req.adminComment}</div>}
                          {overlapping.length>0&&req.status==="pending"&&<div style={{fontSize:10,color:"#92400E",background:"#FFFBEB",borderRadius:4,padding:"2px 6px",marginTop:4,display:"inline-flex",gap:4}}>⚠️ Überschneidung: {overlapping.map(o=>o.name).join(", ")}</div>}
                        </div>
                        <span className={`sc-badge ${req.status==="approved"?"al-ok":req.status==="rejected"?"al-err":"al-warn"}`}>
                          {req.status==="approved"?"✓ Genehmigt":req.status==="rejected"?"✗ Abgelehnt":"⏳ Ausstehend"}
                        </span>
                        {req.status==="pending"&&(
                          <button className="sc-btn sc-btn-p" style={{fontSize:10,padding:"4px 10px"}}
                            onClick={()=>setEditReq({empId:emp.id,year:req.year,reqId:req.id,dates:[...(req.adminDates||req.dates)],comment:req.adminComment||""})}>
                            ✏️ Bearbeiten
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <hr className="sc-div"/>
            </div>
          );
        })}
      </div>
    </div>
  );
  if(!myEmp) return null;
  return <div style={{maxWidth:520}}>{renderEmpPanel(myEmp)}</div>;
}

// Helper: Vacation date editor (mini calendar for admin)
function VacDateEditor({editReq,setEditReq}){
  const year=editReq.year;
  const allMonths=[...new Set(editReq.dates.map(d=>d.slice(0,7)))].sort();
  return(
    <div>
      {allMonths.map(ym=>{
        const [y,m]=ym.split("-").map(Number);
        const numD=daysInMonth(y,m);
        const cells=[];
        const fd=()=>{const d=new Date(y,m-1,1).getDay();return d===0?6:d-1;};
        for(let i=0;i<fd();i++) cells.push(<div key={`e${i}`}/>);
        for(let d=1;d<=numD;d++){
          const date=fmtDate(y,m,d);
          const sel=editReq.dates.includes(date);
          cells.push(
            <div key={d} onClick={()=>setEditReq(p=>{const nd=p.dates.includes(date)?p.dates.filter(x=>x!==date):[...p.dates,date].sort();return{...p,dates:nd};})}
              style={{height:28,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:sel?700:400,cursor:"pointer",background:sel?"#D1FAE5":"#F8FAFC",color:sel?"#065F46":"#475569",border:sel?"2px solid #10B981":"1px solid #E2E8F0"}}>
              {sel?"✓":d}
            </div>
          );
        }
        return(
          <div key={ym} style={{marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748B",marginBottom:6}}>{MONTHS_DE[m-1]} {y}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:3}}>{DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:"#94A3B8"}}>{d}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{cells}</div>
          </div>
        );
      })}
      <div style={{fontSize:11,color:"#64748B"}}>{editReq.dates.length} Tag(e) ausgewählt</div>
    </div>
  );
}

// ── SICK TAB ──────────────────────────────────────────────────────

function SickTab({employees,isAdmin,myEmp,planYear,planMonth,numDays,defaultHolidaySet,sickReqs,submitSick,confirmSick,setSickReqs}){
  const [sel,setSel]=useState(new Set());
  const [note,setNote]=useState("");

  const renderPanel=(emp)=>{
    const allReqs=Object.entries(sickReqs[emp.id]||{}).flatMap(([yr,reqs])=>reqs.map(r=>({...r,year:Number(yr)})));
    const confirmed=new Set(allReqs.filter(r=>r.status==="confirmed").flatMap(r=>r.dates));
    const pending=new Set(allReqs.filter(r=>r.status==="pending").flatMap(r=>r.dates));
    const fd=()=>{const d=new Date(planYear,planMonth-1,1).getDay();return d===0?6:d-1;};
    const cells=[];
    for(let i=0;i<fd();i++) cells.push(<div key={`e${i}`}/>);
    for(let d=1;d<=numDays;d++){
      const date=fmtDate(planYear,planMonth,d),we=getWeekday(planYear,planMonth,d)>=5,hol=defaultHolidaySet.has(date);
      const isC=confirmed.has(date),isP=pending.has(date),isSel=sel.has(date);
      cells.push(
        <div key={d} onClick={isC||isP?null:()=>setSel(p=>{const n=new Set(p);n.has(date)?n.delete(date):n.add(date);return n;})}
          style={{height:32,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,cursor:isC||isP?"default":"pointer",background:isC?"#FED7AA":isP?"#FEF9C3":isSel?"#FED7AA":hol?"#FDE68A":we?"#F1F5F9":"#F8FAFC",color:isC?"#9A3412":isP?"#92400E":isSel?"#9A3412":hol?"#92400E":we?"#CBD5E1":"#475569",border:isSel?"2px solid #F97316":isC?"2px solid #F97316":isP?"2px solid #F59E0B":"1px solid #E2E8F0"}}>
          {isC?"🤒":isP?"⏳":d}
        </div>
      );
    }
    return(
      <div className="sc-card" style={{maxWidth:500}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>🤒 Krankmeldung – {emp.name}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>{DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"#94A3B8"}}>{d}</div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:12}}>{cells}</div>
        <div style={{marginBottom:10}}><div className="lbl" style={{marginBottom:4}}>Hinweis</div><input className="sc-input" value={note} placeholder="z.B. AU ab Tag 4..." onChange={e=>setNote(e.target.value)}/></div>
        <button className="sc-btn sc-btn-o" disabled={sel.size===0} onClick={()=>{submitSick(emp.id,planYear,[...sel].sort(),note);setSel(new Set());setNote("");}}>🤒 {sel.size} Kranktag(e) melden</button>
        {allReqs.length>0&&<><hr className="sc-div"/>
          {allReqs.map(req=>(<div key={req.id} className="vac-req" style={{borderLeftColor:req.status==="confirmed"?"#F97316":"#F59E0B"}}>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{req.dates.length} Tag(e) · {req.year}</div><div style={{fontSize:10,color:"#64748B"}}>{req.dates.join(" · ")}</div>{req.note&&<div style={{fontSize:10,color:"#94A3B8"}}>"{req.note}"</div>}</div>
            <span className={`sc-badge ${req.status==="confirmed"?"al-warn":"al-info"}`}>{req.status==="confirmed"?"🤒 Bestätigt":"⏳ Ausstehend"}</span>
          </div>))}
        </>}
      </div>
    );
  };

  if(!isAdmin&&myEmp) return renderPanel(myEmp);
  return(
    <div className="sc-col" style={{gap:16}}>
      <div className="sc-card">
        <div className="sc-h2">🤒 Krankmeldungen – Bestätigung</div>
        <div className="al al-info" style={{marginBottom:16,fontSize:11}}><strong>§3 EFZG:</strong> Bis 42 Tage = voller Lohn. Ab Tag 43 = Krankengeld der GKV. Bestätigen öffnet die Schicht automatisch für Einspringen.</div>
        {employees.map(emp=>{
          const allReqs=Object.entries(sickReqs[emp.id]||{}).flatMap(([yr,reqs])=>reqs.map(r=>({...r,year:Number(yr)})));
          if(!allReqs.length) return null;
          const totalSick=allReqs.filter(r=>r.status==="confirmed").reduce((a,r)=>a+r.dates.length,0);
          return(
            <div key={emp.id} style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:emp.color}}/>
                <span style={{fontWeight:700}}>{emp.name}</span>
                <span className={`sc-badge ${totalSick>=42?"al-err":totalSick>=20?"al-warn":"al-info"}`}>{totalSick} Krankentage {planYear}{totalSick>=42&&" ⚠️ EFZG!"}</span>
              </div>
              {allReqs.map(req=>{
                const [adminNote,setAdminNote]=useState(req.adminNote||"");
                return(
                  <div key={req.id} className="vac-req" style={{borderLeftColor:req.status==="confirmed"?"#F97316":"#F59E0B",marginBottom:6}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700}}>{req.dates.length} Tag(e) · {req.year}</div>
                      <div style={{fontSize:10,color:"#64748B"}}>{req.dates.join(" · ")}</div>
                      {req.note&&<div style={{fontSize:10,color:"#94A3B8"}}>MA: "{req.note}"</div>}
                      {req.status==="pending"&&<input className="sc-input" value={adminNote} placeholder="Admin-Notiz (optional)" style={{marginTop:6,fontSize:11}} onChange={e=>setAdminNote(e.target.value)}/>}
                    </div>
                    <span className={`sc-badge ${req.status==="confirmed"?"al-warn":"al-info"}`}>{req.status==="confirmed"?"🤒 Bestätigt":"⏳ Offen"}</span>
                    {req.status==="pending"&&<button className="sc-btn sc-btn-o" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>confirmSick(emp.id,req.year,req.id,adminNote)}>✓ Bestätigen</button>}
                  </div>
                );
              })}
              <hr className="sc-div"/>
            </div>
          );
        })}
        {employees.every(emp=>Object.values(sickReqs[emp.id]||{}).flat().length===0)&&<div style={{fontSize:13,color:"#94A3B8",textAlign:"center",padding:24}}>Keine Krankmeldungen vorhanden.</div>}
      </div>
    </div>
  );
}

// ── GENERATE TAB ──────────────────────────────────────────────────

function GenerateTab({employees,care,planYear,planMonth,setPlanYear,setPlanMonth,
  genLoading,genError,genWarns,onGenerate,empHours,getMaxH}){
  const [showPrio,setShowPrio]=useState(false);
  return(
    <div style={{maxWidth:520,margin:"0 auto",display:"flex",flexDirection:"column",gap:12}}>
      <div className="sc-card" style={{padding:"14px 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div className="sc-h2" style={{marginBottom:0,fontSize:14}}>Schichtplan generieren</div>
          <button onClick={()=>setShowPrio(p=>!p)} title="Prioritäten" style={{background:"none",border:"1px solid var(--sc-border)",borderRadius:"50%",width:20,height:20,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--sc-text-3)",flexShrink:0}}>?</button>
        </div>
        {showPrio&&<div className="al al-pur" style={{marginBottom:10,fontSize:10,padding:"6px 10px"}}>
          <strong>Prioritäten:</strong> 1) AG-Wünsche · 2) Kann-Tage · 3) Pensum · 4) Block · 5) Wunsch-Arbeit
        </div>}
        {employees.filter(e=>e.preferredShiftH).length>0&&<div style={{marginBottom:8,display:"flex",gap:6,flexWrap:"wrap"}}>
          {employees.filter(e=>e.preferredShiftH).map(e=>(
            <span key={e.id} style={{fontSize:10,padding:"2px 6px",borderRadius:10,background:e.color+"20",color:e.color,fontWeight:600}}>{e.name} {e.preferredShiftH}h</span>
          ))}
        </div>}
        <button className="sc-btn sc-btn-p" style={{width:"100%",padding:"10px 0",fontSize:13}} onClick={onGenerate} disabled={genLoading}>
          {genLoading?"⏳ Generiere ...":"Plan generieren"}
        </button>
        {genError&&<div className="al al-err" style={{marginTop:10}}>{genError}</div>}
        {genWarns.length>0&&(
          <div style={{marginTop:10}}>
            <div style={{fontWeight:700,fontSize:12,marginBottom:6,color:"#92400E"}}>⚠️ Konflikte ({genWarns.length})</div>
            {["KEIN PERSONAL","WUNSCHKONFLIKT","STUNDENÜBERSCHREITUNG","WUNSCH-ÜBERSCHREIBUNG"].map(type=>{
              const group=genWarns.filter(w=>w.startsWith(`[${type}]`));
              if(!group.length) return null;
              const cfg={
                "KEIN PERSONAL":{icon:"❌",bg:"#FEF2F2",border:"#FECACA",label:"Kein Personal verfügbar"},
                "WUNSCHKONFLIKT":{icon:"⚠️",bg:"#FFFBEB",border:"#FDE68A",label:"Arbeitgeber-Wunsch nicht erfüllbar"},
                "STUNDENÜBERSCHREITUNG":{icon:"⏱️",bg:"#FFF7ED",border:"#FED7AA",label:"MA über Soll-Stunden eingeplant"},
                "WUNSCH-ÜBERSCHREIBUNG":{icon:"🔶",bg:"#FFF7ED",border:"#FED7AA",label:"Wunsch-Frei muss überschrieben werden"},
              }[type];
              return(
                <div key={type} style={{background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:8,padding:"8px 12px",marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:11,marginBottom:4}}>{cfg.icon} {cfg.label} ({group.length}×)</div>
                  {group.map((w,i)=><div key={i} style={{fontSize:10,color:"#374151",padding:"2px 0",borderTop:i>0?"1px solid #E5E7EB":"none"}}>{w.replace(/^\[[^\]]+\] /,"")}</div>)}
                </div>
              );
            })}
            {genWarns.filter(w=>!w.startsWith("[")).map((w,i)=><div key={i} className="al al-warn" style={{padding:"5px 10px",fontSize:11,marginBottom:4}}>{w}</div>)}
          </div>
        )}
      </div>
      <div className="sc-card">
        <div className="sc-h2">Stunden-Übersicht</div>
        {employees.map(emp=>{const h=empHours[emp.id]??0,max=getMaxH(emp),over=h>max;return(
          <div key={emp.id} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,fontSize:12}}>
              <span><span style={{width:8,height:8,borderRadius:"50%",background:emp.color,display:"inline-block",marginRight:5}}/>{emp.name} <span style={{fontSize:10,color:"#94A3B8"}}>{emp.pensumPct}%</span></span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",color:over?"#EF4444":"var(--sc-text-2)",fontSize:11}}>{h}h / {max}h{over?" ⚠️":""}</span>
            </div>
            <div className="prog"><div className="prog-bar" style={{width:`${Math.min(100,(h/max)*100)}%`,background:over?"#EF4444":emp.color}}/></div>
          </div>
        );})}
      </div>
    </div>
  );
}

// ── SCHEDULE TAB ──────────────────────────────────────────────────

function ScheduleTab({employees,activeEmployees,care,schedule,isAdmin,myEmp,planYear,setPlanYear,planMonth,setPlanMonth,numDays,
  holidayMaps,defaultHolidaySet,defaultHolidayMap,empPrefs,empConstraints,vacReqs,sickReqs,adminAbsence,
  getEmpP,getEmpC,getApprovedVacDates,getSickDates,openPopup,empHours,getMaxH,
  filters,setFilters,setTab,takeoverShift,shiftTakeovers,pendingTakeovers,confirmTakeover,setPendingTakeovers,
  appSettings,requestSwap,swapRequests,confirmSwap,rejectSwap,onShowGenerate,
  shiftAdjustments,requestShiftAdjust,reviewMonthChanges,
  planConfirmations,setPlanConfirmations,planVersions,addAudit}){
  const days=Array.from({length:numDays},(_,i)=>i+1);
  const adminAbsDates=new Set(adminAbsence[planYear]?.[planMonth]||[]);
  const moStr=`${planYear}-${fmt2(planMonth)}`;
  useEffect(()=>{
    const el=document.querySelector('[id^="today-"]');
    if(el) setTimeout(()=>el.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"}),200);
  },[planYear,planMonth]);
  const [empPopup,setEmpPopup]=useState(null); // {careId,shiftIdx,shift,emp,x,y,isOwn}
  const [empAction,setEmpAction]=useState(null); // "swap"|"giveaway"|"adjust"|"takeover"
  const [adjMinutes,setAdjMinutes]=useState(0);
  const [adjNote,setAdjNote]=useState("");
  const [swapTarget,setSwapTarget]=useState(null);

  const openEmpPopup=(careId,shiftIdx,shift,emp,e,isOwn)=>{
    e.stopPropagation();
    const r=e.currentTarget.getBoundingClientRect();
    setEmpPopup({careId,shiftIdx,shift,emp,x:Math.min(r.left,window.innerWidth-280),y:Math.min(r.bottom+4,window.innerHeight-320),isOwn});
    setEmpAction(null);setAdjMinutes(shift.durationH*60);setAdjNote("");setSwapTarget(null);
  };
  const closeEmpPopup=()=>{setEmpPopup(null);setEmpAction(null);};
  const submitEmpAction=()=>{
    if(!empPopup) return;
    const{careId,shiftIdx,shift,emp}=empPopup;
    if(empAction==="swap"&&swapTarget){
      requestSwap(emp.id,swapTarget,careId,shiftIdx,shift.startDate);
    } else if(empAction==="giveaway"){
      requestShiftAdjust(emp.id,careId,shiftIdx,shift.startDate,"giveaway",0,adjNote);
    } else if(empAction==="adjust"){
      requestShiftAdjust(emp.id,careId,shiftIdx,shift.startDate,"adjust",adjMinutes,adjNote);
    } else if(empAction==="takeover"&&myEmp){
      requestShiftAdjust(myEmp.id,careId,shiftIdx,shift.startDate,"takeover",0,adjNote);
    }
    closeEmpPopup();
  };

  // Open shifts (sick, awaiting takeover)
  const openShifts=useMemo(()=>{
    const arr=[];
    Object.entries(schedule).forEach(([cId,shifts])=>(shifts||[]).forEach((s,si)=>{
      if(!s.open) return;
      const[sy,sm]=s.startDate.split("-").map(Number);
      if(sy===planYear&&sm===planMonth) arr.push({careId:Number(cId),si,shift:s});
    }));
    return arr;
  },[schedule,planYear,planMonth]);

  const wishMaps=useMemo(()=>{
    const m={};
    employees.forEach(e=>{
      const p=getEmpP(e.id,planYear,planMonth);
      const cnt=getEmpC(e.id,planYear,planMonth);
      const vacApproved=getApprovedVacDates(e.id,planYear);
      const sickConf=getSickDates(e.id,planYear);
      m[e.id]={off:p.wishOff||new Set(),work:p.wishWork||new Set(),vac:vacApproved,sick:sickConf,cannot:cnt.canDates||new Set()};
    });
    return m;
  },[employees,empPrefs,empConstraints,vacReqs,sickReqs,planYear,planMonth]);

  const visibleEmps=useMemo(()=>{
    if(isAdmin) return activeEmployees;
    if(!filters.showAllColleagues&&myEmp) return [myEmp];
    return activeEmployees;
  },[isAdmin,activeEmployees,filters,myEmp]);

  if(!Object.keys(schedule).length) return(
    <div className="sc-card" style={{textAlign:"center",padding:48}}>
      <div style={{fontSize:40,marginBottom:16}}>📅</div>
      <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Noch kein Schichtplan</div>
      {isAdmin&&<button className="sc-btn sc-btn-p" onClick={()=>onShowGenerate?.()}>→ Plan generieren</button>}
    </div>
  );

  return(
    <div>
      {/* Offene Schichten (Krank/Einspringen) */}
      {openShifts.length>0&&(
        <div className="sc-card" style={{marginBottom:16,borderColor:"#F97316"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:"#C2410C"}}>⚡ Offene Schichten – Einspringen möglich!</div>
          {openShifts.map(({careId,si,shift})=>{
            const c=care.find(x=>x.id===careId);
            const origEmp=employees.find(e=>e.id===shift.originalEmpId);
            const [,sm,sd]=shift.startDate.split("-").map(Number);
            const wd=getWeekday(planYear,sm,Number(sd));
            const hasPending=pendingTakeovers.some(p=>p.careId===careId&&p.shiftIdx===si);
            return(
              <div key={`${careId}-${si}`} className="open-shift-card">
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:8}}>
                  <span style={{fontSize:24}}>⚡</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:13}}>{DAYS_LONG[wd]}, {shift.startDate} · {shift.durationH}h</div>
                    {/* Admin sieht Grund; MA nur "Schicht offen" */}
                    <div style={{fontSize:11,color:"#64748B"}}>
                      🏠 {c?.name}{isAdmin?` · ${origEmp?.name} ist krank`:" · Schicht offen"}
                    </div>
                  </div>
                  {hasPending&&<span className="al al-pur" style={{padding:"2px 8px",marginBottom:0,fontSize:10}}>⏳ Anfrage läuft</span>}
                </div>
                {!isAdmin&&myEmp&&!hasPending&&(
                  <button className="sc-btn sc-btn-g" style={{fontSize:11}}
                    onClick={()=>takeoverShift(careId,si,myEmp.id)}>
                    ✋ Ich springe ein ({myEmp.name})
                  </button>
                )}
                {isAdmin&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:"#64748B",alignSelf:"center"}}>Direkt zuweisen:</span>
                    {activeEmployees.filter(e=>e.id!==shift.originalEmpId).map(e=>(
                      <button key={e.id} className="sc-btn sc-btn-s" style={{fontSize:10,padding:"4px 8px"}}
                        onClick={()=>takeoverShift(careId,si,e.id)}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:e.color,display:"inline-block",marginRight:4}}/>
                        {e.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict summary (admin only) */}
      {isAdmin&&(()=>{
        const conflicts=[];
        Object.entries(schedule).forEach(([cId,shifts])=>{
          (shifts||[]).forEach((s,si)=>{
            if(!s.conflict||!s.conflictReason) return;
            const[sy,sm]=s.startDate.split("-").map(Number);
            if(sy!==planYear||sm!==planMonth) return;
            const c2=care.find(x=>x.id===Number(cId));
            const emp2=employees.find(e=>e.id===s.employeeId);
            conflicts.push({careId:Number(cId),si,shift:s,care:c2,emp:emp2});
          });
        });
        if(!conflicts.length) return null;
        return(
          <div className="sc-card" style={{marginBottom:16,borderColor:"var(--sc-warn)"}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#92400E"}}>⚠️ {conflicts.length} Konflikte im Plan</div>
            {conflicts.map((cf,i)=>(
              <div key={i} style={{fontSize:11,padding:"6px 10px",background:"var(--sc-warn-bg)",borderRadius:6,marginBottom:4,border:"1px solid #FDE68A",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontWeight:700,minWidth:70}}>{cf.shift.startDate.slice(5)}</span>
                <span>{cf.care?.name}</span>
                <span style={{color:"var(--sc-text-2)"}}>{cf.shift.conflictReason}</span>
                {cf.emp&&<span style={{marginLeft:"auto",fontWeight:600,color:cf.emp.color}}>{cf.emp.name}</span>}
                {!cf.emp&&<span style={{marginLeft:"auto",fontWeight:600,color:"var(--sc-red)"}}>Unbesetzt</span>}
                {cf.emp&&isAdmin&&<button className="sc-btn sc-btn-s" style={{fontSize:9,padding:"2px 6px"}} onClick={e=>openPopup(cf.careId,cf.si,cf.shift.employeeId,e)}>Bearbeiten</button>}
              </div>
            ))}
          </div>
        );
      })()}

      <div className="sc-card">
        {/* Monatsnavigation mit Pfeilen */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          <button className="sc-btn sc-btn-s" style={{padding:"5px 10px",fontSize:16}} onClick={()=>{
            const nm=planMonth===1?12:planMonth-1,ny=planMonth===1?planYear-1:planYear;
            setPlanMonth(nm);setPlanYear(ny);
          }}>◀</button>
          <div className="sc-h2" style={{marginBottom:0,flex:1,textAlign:"center"}}>📋 {MONTHS_DE[planMonth-1]} {planYear}</div>
          <button className="sc-btn sc-btn-s" style={{padding:"5px 10px",fontSize:16}} onClick={()=>{
            const nm=planMonth===12?1:planMonth+1,ny=planMonth===12?planYear+1:planYear;
            setPlanMonth(nm);setPlanYear(ny);
          }}>▶</button>
          {!isAdmin&&<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {[{k:"showOwnVacation",l:"🏖"},{k:"showWishes",l:"📌"}].map(f=>(
              <button key={f.k} className={`sc-btn ${filters[f.k]?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:11,padding:"4px 7px"}} title={f.k==="showOwnVacation"?"Urlaub anzeigen":"Wünsche anzeigen"} onClick={()=>setFilters(p=>({...p,[f.k]:!p[f.k]}))}>{f.l}</button>
            ))}
          </div>}
        </div>

        {/* Schichttausch-Anfragen (MA-zu-MA) */}
        {swapRequests.filter(r=>r.status==="pending"&&(isAdmin||(myEmp&&(r.fromEmpId===myEmp.id||r.toEmpId===myEmp.id)))).length>0&&(
          <div style={{marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:12,marginBottom:6,color:"#6366F1"}}>🔄 Tausch-Anfragen</div>
            {swapRequests.filter(r=>r.status==="pending").map(r=>{
              const from=employees.find(e=>e.id===r.fromEmpId),to=employees.find(e=>e.id===r.toEmpId);
              return(
                <div key={r.id} style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:8,padding:"8px 12px",marginBottom:6,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:12,flex:1}}>{from?.name} möchte Schicht am <strong>{r.date}</strong> an {to?.name} abgeben</span>
                  {isAdmin&&<><button className="sc-btn sc-btn-r" style={{fontSize:10}} onClick={()=>rejectSwap(r.id)}>✗</button><button className="sc-btn sc-btn-g" style={{fontSize:10}} onClick={()=>confirmSwap(r.id)}>✓ Bestätigen</button></>}
                  {!isAdmin&&myEmp?.id===r.toEmpId&&<button className="sc-btn sc-btn-g" style={{fontSize:10}} onClick={()=>confirmSwap(r.id)}>✓ Ich übernehme</button>}
                </div>
              );
            })}
          </div>
        )}

        {/* Legende */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12,fontSize:10,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4}}>
          {[{bg:"rgba(254,226,226,.65)",b:"#FECACA",l:"🔴 Frei"},{bg:"rgba(220,252,231,.65)",b:"#A7F3D0",l:"🟢 Arbeit"},{bg:"rgba(254,249,195,.75)",b:"#FDE68A",l:"🏖 Urlaub"},{bg:"rgba(220,252,231,.5)",b:"#16A34A",l:"✅ Kann"},{bg:"#FEF9C3",b:"#FDE68A",l:"🎉 Feiertag"}].map((x,i)=>(
            <span key={i} style={{background:x.bg,border:`1px solid ${x.b}`,padding:"2px 7px",borderRadius:4,whiteSpace:"nowrap",flexShrink:0}}>{x.l}</span>
          ))}
          {isAdmin&&<span style={{background:"rgba(254,215,170,.75)",border:"1px solid #FED7AA",padding:"2px 7px",borderRadius:4}}>🤒 Krank (nur Admin)</span>}
          {!isAdmin&&<span style={{background:"rgba(203,213,225,.4)",border:"1px solid #CBD5E1",padding:"2px 7px",borderRadius:4}}>⛔ Nicht verfügbar</span>}
          {isAdmin&&<span style={{background:"rgba(239,68,68,.1)",border:"2px dashed #EF4444",padding:"2px 7px",borderRadius:4}}>⚠️ Konflikt</span>}
          <span style={{background:"#FFF7ED",border:"2px solid #F97316",padding:"2px 7px",borderRadius:4}}>⚡ Offen</span>
        </div>

        {/* Vereinfachte Einzel-Arbeitgeber-Ansicht */}
        {care.map(c=>{
          const cHolidayMap=holidayMaps[c.id]||defaultHolidayMap;
          const cHolidaySet=new Set(Object.keys(cHolidayMap));
          const shifts=schedule[c.id]||[];
          const empMap={};
          activeEmployees.forEach(e=>empMap[e.id]={});
          shifts.forEach((s,si)=>{
            const[sy,sm,sd]=s.startDate.split("-").map(Number);
            if(sy!==planYear||sm!==planMonth) return;
            if(s.employeeId&&empMap[s.employeeId]){
              if(!empMap[s.employeeId][sd]) empMap[s.employeeId][sd]=[];
              empMap[s.employeeId][sd].push({...s,si,span:Math.ceil(s.durationH/24),
                startH:c.shiftStartHour+(s.slot||0)*s.durationH,
                isNight:((c.shiftStartHour+(s.slot||0)*s.durationH)%24)>=18||((c.shiftStartHour+(s.slot||0)*s.durationH)%24)<6
              });
            }
          });
          return(
            <div key={c.id} style={{marginBottom:24}}>
              <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontWeight:700,fontSize:13}}>🏠 {c.name}</span>
                <span style={{fontSize:10,color:"#94A3B8"}}>{BUNDESLAENDER[c.bundesland||"BW"]}</span>
                {c.notes&&<span style={{fontSize:11,color:"#64748B"}}>{c.notes}</span>}
              </div>
              <div className="tbl-wrap">
                <table className="sc-tbl">
                  <thead>
                    <tr>
                      <th style={{minWidth:130,position:"sticky",left:0,zIndex:3,background:"var(--sc-card)",textAlign:"left",boxShadow:"2px 0 4px rgba(0,0,0,.06)"}}>Mitarbeiter</th>
                      {days.map(d=>{
                        const dt=fmtDate(planYear,planMonth,d),hol=cHolidaySet.has(dt),we=isWeekend(planYear,planMonth,d),abs=adminAbsDates.has(dt);
                        const isToday=dt===today();
                        return(
                          <th key={d} className={abs?"th-admin-abs":hol?"th-hday":we?"th-wknd":""}
                            style={isToday?{background:"var(--sc-accent)",color:"#fff",borderColor:"var(--sc-accent)"}:undefined}
                            title={hol?cHolidayMap[dt]:abs?"Arbeitgeber abwesend":""}
                            id={isToday?`today-${c.id}`:undefined}>
                            <div>{d}</div>
                            <div style={{fontWeight:400,fontSize:9,color:"#94A3B8"}}>{DAYS_SHORT[getWeekday(planYear,planMonth,d)]}</div>
                            {hol&&<div style={{fontSize:8}}>🎉</div>}
                            {abs&&<div style={{fontSize:8}}>🏡</div>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmps.map(emp=>{
                      const skipTo=new Set();
                      const wm=wishMaps[emp.id]||{off:new Set(),work:new Set(),vac:new Set(),sick:new Set(),cannot:new Set()};
                      const isMe=myEmp?.id===emp.id;
                      return(
                        <tr key={emp.id}>
                          <td className="name-cell">
                            <span style={{width:8,height:8,borderRadius:"50%",background:emp.color,display:"inline-block",marginRight:5,verticalAlign:"middle"}}/>
                            {emp.name}{!isAdmin&&isMe&&<span style={{fontSize:9,color:"#0EA5E9",marginLeft:4}}>(Ich)</span>}
                            <div style={{fontSize:9,color:"#94A3B8"}}>{emp.pensumPct}%</div>
                          </td>
                          {days.map(d=>{
                            if(skipTo.has(d)) return null;
                            const slots=empMap[emp.id]?.[d];
                            const dt=fmtDate(planYear,planMonth,d);
                            const showWish=filters.showWishes||isAdmin;
                            if(slots&&slots.length>0){
                              const firstSlot=slots[0];
                              for(let x=1;x<firstSlot.span;x++) skipTo.add(d+x);
                              let bgOverlay="";
                              if(showWish){
                                if(wm.cannot.has(dt))                     bgOverlay="rgba(22,163,74,.15)";
                                else if(wm.off.has(dt))                   bgOverlay="rgba(239,68,68,.18)";
                                else if(wm.sick.has(dt)&&isAdmin)         bgOverlay="rgba(249,115,22,.25)";
                                else if(wm.work.has(dt))                  bgOverlay="rgba(16,185,129,.18)";
                              }
                              return(
                                <td key={d} colSpan={firstSlot.span} style={{padding:"1px",background:bgOverlay||undefined}}
                                  title={slots.map(s=>`${fmt2(s.startH%24)}:00–${fmt2((s.startH+s.durationH)%24)}:00 (${s.durationH}h)${s.conflictReason?" ⚠️ "+s.conflictReason:""}`).join("\n")}>
                                  <div style={{display:"flex",flexDirection:"column",gap:1,height:slots.length>1?slots.length*14+2:28}}>
                                    {slots.map((si,idx)=>(
                                      <div key={idx}
                                        onClick={isAdmin?e=>openPopup(c.id,si.si,si.employeeId,e):(!si.open&&myEmp?e=>openEmpPopup(c.id,si.si,si,emp,e,isMe):undefined)}
                                        style={{cursor:(isAdmin||(!si.open&&myEmp))?"pointer":"default",flex:1,minHeight:slots.length>1?13:26}}>
                                        {si.open?(
                                          <div style={{background:"#F97316",color:"#fff",borderRadius:4,fontSize:8,fontWeight:700,textAlign:"center",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>OFFEN</div>
                                        ):(
                                          <div className={`shift-blk${si.conflict?" conflict":""}`}
                                            style={{background:si.isNight?`color-mix(in srgb, ${emp.color} 70%, #1E293B)`:emp.color,
                                              height:"100%",fontSize:slots.length>1?8:10,padding:slots.length>1?"1px 3px":"3px 6px"}}>
                                            <span>{si.durationH}h{slots.length>1?` ${fmt2(si.startH%24)}`:""}{si.conflict?" ⚠️":""}{si.takenOver?" 🤝":""}</span>
                                            {isAdmin&&slots.length===1&&<span style={{fontSize:9,opacity:.7}}>✏️</span>}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              );
                            }
                            // Leere Zelle mit Wunsch-Hintergrund
                            let cls="",overlayIcon="";
                            const isSickDay=wm.sick.has(dt);
                            if(showWish){
                              if(isSickDay){
                                if(isAdmin){cls="cell-sick";overlayIcon="🤒";}
                                else{cls="";overlayIcon="⛔";} // MA sieht nur "Nicht verfügbar"
                              }
                              else if(wm.vac.has(dt)&&(filters.showOwnVacation||isAdmin)){cls="cell-vac";overlayIcon="🏖";}
                              else if(wm.cannot.has(dt)){cls="cell-cannot";overlayIcon="✅";}
                              else if(wm.off.has(dt)){cls="cell-off";overlayIcon="🔴";}
                              else if(wm.work.has(dt)){cls="cell-work";overlayIcon="🟢";}
                            }
                            return(
                              <td key={d} className={cls}
                                title={wm.sick.has(dt)?"Krank":wm.vac.has(dt)?"Urlaub":wm.cannot.has(dt)?"✅ Kann":wm.off.has(dt)?"Wunsch-Frei":wm.work.has(dt)?"Wunsch-Arbeit":""}>
                                {overlayIcon&&<span style={{fontSize:9,opacity:.7}}>{overlayIcon}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {/* Stunden-Übersicht */}
        <hr className="sc-div"/>
        <div className="lbl" style={{marginBottom:10}}>Stunden-Übersicht – {MONTHS_DE[planMonth-1]} {planYear}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8}}>
          {(isAdmin?activeEmployees:myEmp?[myEmp]:[]).map(emp=>{
            const h=empHours[emp.id]??0,max=getMaxH(emp),over=h>max;
            return(
              <div key={emp.id} style={{background:"#F8FAFC",borderRadius:10,padding:"10px 14px",border:`1px solid ${over?"#FECACA":"#E2E8F0"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:emp.color}}/>
                  <span style={{fontSize:11,fontWeight:600}}>{emp.name}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                  <span style={{color:"#94A3B8"}}>Ist/Soll</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:over?"#EF4444":"#0EA5E9",fontWeight:700}}>{h}/{max}h</span>
                </div>
                <div className="prog"><div className="prog-bar" style={{width:`${Math.min(100,(h/max)*100)}%`,background:over?"#EF4444":emp.color}}/></div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Plan-Bestätigung */}
      {!isAdmin&&myEmp&&Object.keys(schedule).length>0&&(
        <div className="sc-card" style={{marginTop:12}}>
          {(()=>{
            const conf=planConfirmations?.[`${myEmp.id}_${moStr}`];
            const curVersion=planVersions?.[moStr];
            const isValid=conf&&conf.planVersion===curVersion;
            return isValid?(
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span className="al al-ok" style={{padding:"6px 14px",marginBottom:0,fontSize:12}}>✅ Plan bestätigt am {new Date(conf.ts).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                <button className="sc-btn sc-btn-s" style={{fontSize:10,marginLeft:"auto"}} onClick={()=>{
                  setPlanConfirmations(p=>{const n={...p};delete n[`${myEmp.id}_${moStr}`];return n;});
                  addAudit?.("plan_unconfirmed",`${myEmp.name} hat Planbestätigung aufgehoben`,moStr);
                }}>Bestätigung aufheben</button>
              </div>
            ):(
              <div>
                {conf&&!isValid&&<div className="al al-warn" style={{marginBottom:8,fontSize:11}}>Der Plan wurde seit deiner letzten Bestätigung geändert. Bitte erneut prüfen und bestätigen.</div>}
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div style={{flex:1,fontSize:12,color:"var(--sc-text-2)"}}>Bitte überprüfe deinen Schichtplan und bestätige, dass alle Angaben korrekt sind.</div>
                  <button className="sc-btn sc-btn-g" style={{fontSize:12}} onClick={()=>{
                    const now3=new Date().toISOString();
                    setPlanConfirmations(p=>({...p,[`${myEmp.id}_${moStr}`]:{ts:now3,planVersion:planVersions?.[moStr]||now3}}));
                    addAudit?.("plan_confirmed",`${myEmp.name} hat Plan bestätigt`,moStr);
                  }}>✅ Plan bestätigen</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {/* Plan-Bestätigungsstatus (Admin) */}
      {isAdmin&&Object.keys(schedule).length>0&&(
        <div className="sc-card" style={{marginTop:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <div style={{fontWeight:700,fontSize:12}}>Planbestätigung {MONTHS_DE[planMonth-1]}</div>
            {(()=>{
              const curV=planVersions?.[moStr];
              const confirmed=activeEmployees.filter(e=>{const c2=planConfirmations?.[`${e.id}_${moStr}`];return c2&&c2.planVersion===curV;});
              return <span className="sc-badge" style={{background:confirmed.length===activeEmployees.length?"var(--sc-green-bg)":"var(--sc-warn-bg)",
                color:confirmed.length===activeEmployees.length?"var(--sc-green)":"#92400E"}}>{confirmed.length}/{activeEmployees.length}</span>;
            })()}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {activeEmployees.map(e=>{
              const conf=planConfirmations?.[`${e.id}_${moStr}`];
              const valid=conf&&conf.planVersion===planVersions?.[moStr];
              return <span key={e.id} title={valid?`Bestätigt: ${new Date(conf.ts).toLocaleString("de-DE")}`:conf?"Veraltet – Plan geändert":"Ausstehend"}
                style={{fontSize:10,padding:"3px 8px",borderRadius:6,
                background:valid?"var(--sc-green-bg)":conf?"var(--sc-warn-bg)":"var(--sc-subtle)",
                color:valid?"var(--sc-green)":conf?"#92400E":"var(--sc-text-3)",
                border:`1px solid ${valid?"#A7F3D0":conf?"#FDE68A":"var(--sc-border)"}`}}>{e.name} {valid?"✓":conf?"⚠":"–"}</span>;
            })}
          </div>
        </div>
      )}
      {/* Employee shift action popup */}
      {empPopup&&(
        <>
          <div className="popup-overlay" onClick={closeEmpPopup}/>
          <div className="shift-popup" style={{left:empPopup.x,top:empPopup.y,minWidth:260,maxWidth:320}}>
            <div className="shift-popup-hdr">
              {empPopup.shift.startDate} · {empPopup.shift.durationH}h · {empPopup.emp.name}
            </div>
            {!empAction&&(
              <div style={{padding:8,display:"flex",flexDirection:"column",gap:6}}>
                {empPopup.isOwn?(
                  <>
                    <button className="sc-btn sc-btn-s" style={{width:"100%",justifyContent:"flex-start",display:"flex",gap:8,alignItems:"center",fontSize:13,padding:"10px 12px"}}
                      onClick={()=>setEmpAction("swap")}>🔄 Schicht tauschen</button>
                    <button className="sc-btn sc-btn-s" style={{width:"100%",justifyContent:"flex-start",display:"flex",gap:8,alignItems:"center",fontSize:13,padding:"10px 12px"}}
                      onClick={()=>setEmpAction("giveaway")}>📤 Schicht abgeben</button>
                    <button className="sc-btn sc-btn-s" style={{width:"100%",justifyContent:"flex-start",display:"flex",gap:8,alignItems:"center",fontSize:13,padding:"10px 12px"}}
                      onClick={()=>setEmpAction("adjust")}>⏱️ Zeit anpassen</button>
                  </>
                ):(
                  <button className="sc-btn sc-btn-s" style={{width:"100%",justifyContent:"flex-start",display:"flex",gap:8,alignItems:"center",fontSize:13,padding:"10px 12px"}}
                    onClick={()=>setEmpAction("takeover")}>🤝 Schicht übernehmen</button>
                )}
              </div>
            )}
            {empAction==="takeover"&&(
              <div style={{padding:10}}>
                <div style={{fontSize:12,marginBottom:8}}>Schicht von <strong>{empPopup.emp.name}</strong> am <strong>{empPopup.shift.startDate}</strong> ({empPopup.shift.durationH}h) übernehmen?</div>
                <input className="sc-input" value={adjNote} placeholder="Anmerkung (optional)" onChange={e=>setAdjNote(e.target.value)} style={{marginBottom:8}}/>
                <div style={{display:"flex",gap:6}}>
                  <button className="sc-btn sc-btn-s" style={{flex:1,fontSize:11}} onClick={closeEmpPopup}>Abbrechen</button>
                  <button className="sc-btn sc-btn-g" style={{flex:1,fontSize:11}} onClick={submitEmpAction}>Übernehmen</button>
                </div>
              </div>
            )}
            {empAction==="swap"&&(
              <div style={{padding:10}}>
                <div className="lbl" style={{marginBottom:6}}>Mit wem tauschen?</div>
                {activeEmployees.filter(e=>e.id!==empPopup.emp.id).map(e=>(
                  <button key={e.id} onClick={()=>setSwapTarget(e.id)}
                    className={`shift-popup-emp${swapTarget===e.id?" current":""}`}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:e.color,display:"inline-block"}}/>
                    <span style={{flex:1}}>{e.name}</span>
                    {swapTarget===e.id&&<span style={{color:"var(--sc-accent)",fontSize:10}}>✓</span>}
                  </button>
                ))}
                <div style={{display:"flex",gap:6,marginTop:8}}>
                  <button className="sc-btn sc-btn-s" style={{flex:1,fontSize:11}} onClick={()=>setEmpAction(null)}>Zurück</button>
                  <button className="sc-btn sc-btn-p" style={{flex:1,fontSize:11}} onClick={submitEmpAction} disabled={!swapTarget}>Tauschen</button>
                </div>
              </div>
            )}
            {empAction==="giveaway"&&(
              <div style={{padding:10}}>
                <div style={{fontSize:12,marginBottom:8}}>Schicht am <strong>{empPopup.shift.startDate}</strong> abgeben und zur Übernahme freigeben?</div>
                <input className="sc-input" value={adjNote} placeholder="Grund (optional)" onChange={e=>setAdjNote(e.target.value)} style={{marginBottom:8}}/>
                <div style={{display:"flex",gap:6}}>
                  <button className="sc-btn sc-btn-s" style={{flex:1,fontSize:11}} onClick={()=>setEmpAction(null)}>Zurück</button>
                  <button className="sc-btn sc-btn-o" style={{flex:1,fontSize:11}} onClick={submitEmpAction}>Abgeben</button>
                </div>
              </div>
            )}
            {empAction==="adjust"&&(
              <div style={{padding:10}}>
                <div className="lbl" style={{marginBottom:6}}>Tatsächlich gearbeitete Zeit</div>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
                  <div>
                    <div style={{fontSize:9,color:"var(--sc-text-3)",marginBottom:2}}>Stunden</div>
                    <input type="number" className="sc-input" style={{width:60,textAlign:"center"}} min={0} max={24}
                      value={Math.floor(adjMinutes/60)} onChange={e=>setAdjMinutes(Number(e.target.value)*60+(adjMinutes%60))}/>
                  </div>
                  <span style={{fontSize:16,marginTop:14}}>:</span>
                  <div>
                    <div style={{fontSize:9,color:"var(--sc-text-3)",marginBottom:2}}>Minuten</div>
                    <input type="number" className="sc-input" style={{width:60,textAlign:"center"}} min={0} max={59}
                      value={adjMinutes%60} onChange={e=>setAdjMinutes(Math.floor(adjMinutes/60)*60+Number(e.target.value))}/>
                  </div>
                  <span style={{fontSize:11,color:"var(--sc-text-3)",marginTop:14}}>= {Math.floor(adjMinutes/60)}h {adjMinutes%60}min</span>
                </div>
                <div style={{fontSize:10,color:"var(--sc-text-3)",marginBottom:6}}>Plan: {empPopup.shift.durationH}h → Ist: {(adjMinutes/60).toFixed(1)}h ({adjMinutes>empPopup.shift.durationH*60?"+":""}{Math.round(adjMinutes-empPopup.shift.durationH*60)}min)</div>
                <input className="sc-input" value={adjNote} placeholder="Begründung (optional)" onChange={e=>setAdjNote(e.target.value)} style={{marginBottom:8}}/>
                <div style={{display:"flex",gap:6}}>
                  <button className="sc-btn sc-btn-s" style={{flex:1,fontSize:11}} onClick={()=>setEmpAction(null)}>Zurück</button>
                  <button className="sc-btn sc-btn-p" style={{flex:1,fontSize:11}} onClick={submitEmpAction}>Speichern</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {/* Change log for admin (this month) */}
      {isAdmin&&(shiftAdjustments||[]).filter(r=>r.date?.startsWith(moStr)&&r.status==="applied").length>0&&(
        <div className="sc-card" style={{marginTop:16,borderColor:"var(--sc-accent)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
            <div style={{fontWeight:700,fontSize:13,color:"var(--sc-accent)"}}>📝 Änderungsprotokoll {MONTHS_DE[planMonth-1]}</div>
            <span className="sc-badge" style={{background:"var(--sc-accent-bg)",color:"var(--sc-accent)"}}>{(shiftAdjustments||[]).filter(r=>r.date?.startsWith(moStr)&&r.status==="applied").length} offen</span>
            <button className="sc-btn sc-btn-g" style={{marginLeft:"auto",fontSize:11}} onClick={()=>reviewMonthChanges(moStr)}>✓ Alle prüfen & freigeben</button>
          </div>
          {(shiftAdjustments||[]).filter(r=>r.date?.startsWith(moStr)&&r.status==="applied").map(r=>{
            const emp=employees.find(e=>e.id===r.empId);
            const typeLabel={adjust:"⏱️ Zeitkorrektur",giveaway:"📤 Abgabe",takeover:"🤝 Übernahme",swap:"🔄 Tausch"}[r.type]||r.type;
            return(
              <div key={r.id} style={{fontSize:11,padding:"4px 0",borderTop:"1px solid var(--sc-border-2)",display:"flex",gap:8,alignItems:"center"}}>
                <span style={{color:"var(--sc-text-3)",fontSize:10,minWidth:70}}>{r.date?.slice(5)}</span>
                <span>{typeLabel}</span>
                <strong>{emp?.name}</strong>
                {r.type==="adjust"&&<span style={{color:"var(--sc-text-3)"}}>{Math.floor((r.actualMinutes||0)/60)}h {(r.actualMinutes||0)%60}min</span>}
                {r.note&&<span style={{color:"var(--sc-text-3)",fontStyle:"italic"}}>"{r.note}"</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PutzplanTab({care,employees,isAdmin,myEmp,cleaningTasks,setCleaningTasks,cleaningLog,setCleaningLog,schedule,planYear,planMonth}){
  const [selCare,setSelCare]=useState(care[0]?.id||null);
  const [newTask,setNewTask]=useState({title:"",interval:"weekly",weekday:0,dayOfMonth:1,assignedEmpId:null});
  const today_=today();
  const tasks=cleaningTasks[selCare]||[];
  const log=cleaningLog[selCare]||{};
  const getDueDates=(task,y,m)=>{
    const numD=daysInMonth(y,m),dates=[];
    for(let d=1;d<=numD;d++){
      const date=fmtDate(y,m,d),wd=getWeekday(y,m,d);
      if(task.interval==="daily") dates.push(date);
      else if(task.interval==="weekly"&&wd===task.weekday) dates.push(date);
      else if(task.interval==="monthly"&&d===task.dayOfMonth) dates.push(date);
      else if(task.interval==="once"&&d===task.dayOfMonth) dates.push(date);
    }
    return dates;
  };
  const toggleDone=(taskId,date,empId)=>setCleaningLog(prev=>{
    const cl={...(prev[selCare]||{})};const dl={...(cl[date]||{})};
    if(dl[taskId]?.done) delete dl[taskId]; else dl[taskId]={done:true,doneByEmpId:empId,doneAt:new Date().toISOString()};
    cl[date]=dl;return{...prev,[selCare]:cl};
  });
  const addTask=()=>{if(!newTask.title) return;setCleaningTasks(p=>({...p,[selCare]:[...(p[selCare]||[]),{...newTask,id:Date.now()+"",active:true}]}));setNewTask({title:"",interval:"weekly",weekday:0,dayOfMonth:1,assignedEmpId:null});};
  const shiftDates=[...new Set((schedule[selCare]||[]).filter(s=>{const[sy,sm]=s.startDate.split("-").map(Number);return sy===planYear&&sm===planMonth;}).map(s=>s.startDate))].sort();
  return(
    <div className="sc-col" style={{gap:16}}>
      <div className="sc-card" style={{padding:"12px 18px"}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700}}>✅ To-Do's für:</span>
          {care.map(c=><button key={c.id} className={`sc-btn ${selCare===c.id?"sc-btn-p":"sc-btn-s"}`} onClick={()=>setSelCare(c.id)}>{c.name}</button>)}
        </div>
      </div>
      <div className="sc-grid2">
        {isAdmin&&(
          <div className="sc-card">
            <div className="sc-h2">⚙️ Aufgaben verwalten</div>
            <div style={{background:"#F8FAFC",borderRadius:8,padding:12,marginBottom:12,border:"1px solid #E2E8F0"}}>
              <div className="lbl" style={{marginBottom:8}}>Neue Aufgabe</div>
              <input className="sc-input" value={newTask.title} placeholder="Aufgabe (z.B. Bad putzen, Einkaufen, Arzttermin)" onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} style={{marginBottom:8}}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div><div className="lbl">Intervall</div><select className="sc-sel" style={{width:"100%"}} value={newTask.interval} onChange={e=>setNewTask(p=>({...p,interval:e.target.value}))}>{CLEAN_INTERVALS.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}</select></div>
                {newTask.interval==="weekly"&&<div><div className="lbl">Wochentag</div><select className="sc-sel" style={{width:"100%"}} value={newTask.weekday} onChange={e=>setNewTask(p=>({...p,weekday:Number(e.target.value)}))}>{DAYS_LONG.map((d,i)=><option key={i} value={i}>{d}</option>)}</select></div>}
                {(newTask.interval==="monthly"||newTask.interval==="once")&&<div><div className="lbl">Tag des Monats</div><input type="number" className="sc-input" min={1} max={31} value={newTask.dayOfMonth} onChange={e=>setNewTask(p=>({...p,dayOfMonth:Number(e.target.value)}))}/></div>}
                <div><div className="lbl">Zuständig</div><select className="sc-sel" style={{width:"100%"}} value={newTask.assignedEmpId||""} onChange={e=>setNewTask(p=>({...p,assignedEmpId:e.target.value?Number(e.target.value):null}))}><option value="">Alle</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              </div>
              <button className="sc-btn sc-btn-g" style={{width:"100%"}} onClick={addTask} disabled={!newTask.title}>+ Aufgabe hinzufügen</button>
            </div>
            {tasks.map(task=>{
              const assigned=task.assignedEmpId?employees.find(e=>e.id===task.assignedEmpId):null;
              return(<div key={task.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0",marginBottom:4}}>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{task.title}</div><div style={{fontSize:10,color:"#94A3B8"}}>{CLEAN_INTERVALS.find(i=>i.value===task.interval)?.label}{task.interval==="weekly"&&` · ${DAYS_LONG[task.weekday]}`}{assigned&&` · ${assigned.name}`}</div></div>
                <button onClick={()=>setCleaningTasks(p=>({...p,[selCare]:(p[selCare]||[]).filter(t=>t.id!==task.id)}))} style={{background:"transparent",border:"none",cursor:"pointer",color:"#EF4444",fontSize:16}}>×</button>
              </div>);
            })}
          </div>
        )}
        <div className="sc-card" style={!isAdmin?{gridColumn:"1/-1"}:{}}>
          <div className="sc-h2">📅 {MONTHS_DE[planMonth-1]} {planYear}</div>
          {shiftDates.length===0&&<div style={{fontSize:12,color:"#94A3B8",textAlign:"center",padding:24}}>Kein Schichtplan für diesen Monat.</div>}
          {shiftDates.map(date=>{
            const shift=(schedule[selCare]||[]).find(s=>s.startDate===date);
            const emp=shift?employees.find(e=>e.id===shift.employeeId):null;
            const[,, dd]=date.split("-");const wd=getWeekday(...date.split("-").map(Number));
            const dueTasks=tasks.filter(t=>getDueDates(t,planYear,planMonth).includes(date));
            return(
              <div key={date} style={{marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{fontWeight:700,fontSize:12}}>{DAYS_LONG[wd]}, {Number(dd)}. {MONTHS_DE[planMonth-1]}</div>
                  {emp&&<span style={{fontSize:11,background:emp.color,color:"#fff",borderRadius:4,padding:"2px 7px",fontWeight:600}}>{emp.name}</span>}
                </div>
                {dueTasks.length===0?<div style={{fontSize:11,color:"#94A3B8",fontStyle:"italic"}}>Keine Aufgaben.</div>:
                  dueTasks.map(task=>{
                    const doneInfo=log[date]?.[task.id],isDone=doneInfo?.done,doneBy=employees.find(e=>e.id===doneInfo?.doneByEmpId);
                    const isOverdue=!isDone&&date<today_;
                    const assigned=task.assignedEmpId?employees.find(e=>e.id===task.assignedEmpId):null;
                    const canDo=isAdmin||(myEmp&&(!assigned||assigned.id===myEmp.id));
                    return(
                      <div key={task.id} className={`clean-task${isDone?" done":isOverdue?" overdue":""}`}>
                        <div className={`clean-check${isDone?" checked":""}`} onClick={()=>canDo&&toggleDone(task.id,date,isAdmin?employees[0]?.id:myEmp?.id)} style={{cursor:canDo?"pointer":"default"}}>{isDone?"✓":""}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,fontWeight:600,textDecoration:isDone?"line-through":"none"}}>{task.title}</div>
                          <div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>{isOverdue&&"⚠️ Überfällig · "}{assigned&&`Zuständig: ${assigned.name} · `}{isDone&&doneBy&&`✓ ${doneBy.name}`}</div>
                        </div>
                        {isOverdue&&<span style={{fontSize:9,background:"#FEF2F2",color:"#991B1B",padding:"2px 6px",borderRadius:4,fontWeight:700}}>ÜBERFÄLLIG</span>}
                      </div>
                    );
                  })
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── PAYROLL TAB ───────────────────────────────────────────────────

function PayrollTab({employees,care,schedule,surcharges,holidayMaps,defaultHolidayMap,planYear,planMonth,
  sickReqs,vacReqs,payrollConf,setPayrollConf,getMaxH,exportCSV,shiftTakeovers,
  appSettings,setAppSettings,payrollOverrides,applyPayrollOverride,undoPayrollOverride,holidayStats,
  shiftAdjustments,reviewMonthChanges,
  planConfirmations,activeEmployees,planVersions,
  addAudit,auditLog}){  const {holiday:holPct,sunday:sunPct,night:nightPct,nightStart,nightEnd}=surcharges;
  const [csvSep,setCsvSep]=useState(",");
  const [overrideModal,setOverrideModal]=useState(null); // {empId,field,curVal,label}
  const [overrideReason,setOverrideReason]=useState("");
  const [overrideNewVal,setOverrideNewVal]=useState("");
  const [holSunExpanded,setHolSunExpanded]=useState(null);
  const moStr=`${planYear}-${fmt2(planMonth)}`;

  const calcEmpPayroll=emp=>{
    let totalShifts=0,totalH=0,holH=0,sunH=0,nightH_=0;
    care.forEach(c=>{
      const hMap=holidayMaps[c.id]||defaultHolidayMap;
      (schedule[c.id]||[]).forEach(s=>{
        const[sy,sm]=s.startDate.split("-").map(Number);
        if(sy!==planYear||sm!==planMonth||s.employeeId!==emp.id) return;
        totalShifts++;totalH+=s.durationH;
        const r=calcShiftHours(s.startDate,c.shiftStartHour,s.durationH,hMap,nightStart,nightEnd,c.shiftStartsEve);
        holH+=r.holH;sunH+=r.sunH;nightH_+=r.nightH;
      });
    });
    const rate=emp.hourlyRate||0;
    const dailyH=emp.dailyContractHours??8;
    const grundlohn=totalH*rate;
    const holS=(holPct/100)*rate*holH;
    const sunS=(sunPct/100)*rate*sunH;
    const nightS=(nightPct/100)*rate*nightH_;
    const zuschlagGes=holS+sunS+nightS;
    const vacDays=(vacReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="approved")
      .flatMap(r=>r.adminDates||r.dates).filter(d=>d.startsWith(moStr)).length;
    const vacLohn=vacDays*dailyH*rate; // Urlaubsentgelt §11 BUrlG
    const sickDaysMonth=(sickReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="confirmed")
      .flatMap(r=>r.dates).filter(d=>d.startsWith(moStr)).length;
    const sickDaysYear=(sickReqs[emp.id]?.[planYear]||[]).filter(r=>r.status==="confirmed")
      .reduce((a,r)=>a+r.dates.length,0);
    const takenOver=shiftTakeovers.filter(t=>t.newEmpId===emp.id&&t.date.startsWith(moStr)).length;
    const gaveAway=shiftTakeovers.filter(t=>t.originalEmpId===emp.id&&t.date.startsWith(moStr)).length;
    // Manuelle Overrides anwenden
    const overrides=payrollOverrides?.[`${emp.id}_${moStr}`]||[];
    const latestOverrides={};
    overrides.forEach(o=>{latestOverrides[o.field]=o;});
    return{totalShifts,totalH,holH,sunH,nightH:nightH_,grundlohn,holS,sunS,nightS,
      zuschlagGes,vacDays,vacLohn,dailyH,
      brutto:grundlohn+zuschlagGes+vacLohn,
      sickDaysMonth,sickDaysYear,takenOver,gaveAway,overrides,latestOverrides};
  };

  const allConf=employees.every(e=>payrollConf[e.id]?.[moStr]);

  return(
    <div className="sc-col" style={{gap:16}}>
      {overrideModal&&(
        <div className="dlg-overlay" onClick={()=>setOverrideModal(null)}>
          <div className="dlg" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>✏️ {overrideModal.label} anpassen</div>
            <div style={{fontSize:12,color:"#64748B",marginBottom:14}}>Aktueller Wert: <strong>{overrideModal.curVal}</strong></div>
            <div className="lbl" style={{marginBottom:4}}>Neuer Wert</div>
            <input className="sc-input" value={overrideNewVal} placeholder="Neuer Wert" style={{marginBottom:10}} onChange={e=>setOverrideNewVal(e.target.value)}/>
            <div className="lbl" style={{marginBottom:4}}>Begründung (Pflicht)</div>
            <input className="sc-input" value={overrideReason} placeholder="z.B. Korrektur wegen AU-Bescheinigung" onChange={e=>setOverrideReason(e.target.value)}/>
            <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}>
              <button className="sc-btn sc-btn-s" onClick={()=>setOverrideModal(null)}>Abbrechen</button>
              <button className="sc-btn sc-btn-p" disabled={!overrideReason||!overrideNewVal}
                onClick={()=>{applyPayrollOverride(overrideModal.empId,moStr,overrideModal.field,overrideModal.curVal,overrideNewVal,overrideReason);setOverrideModal(null);setOverrideReason("");setOverrideNewVal("");}}>
                ✓ Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feier-/Sonntags-Fairness Jahresübersicht */}
      <div className="sc-card">
        <div className="sc-h2">☀️ Feier- & Sonntagsverteilung {planYear} (Kalenderjahr)</div>
        <div className="al al-info" style={{marginBottom:10,fontSize:11}}>Nur die Person mit der Mehrheit der Stunden eines Tages wird gezählt. Klicken für Details.</div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:11}}>
            <thead><tr>
              <th style={{background:"#F8FAFC",padding:"5px 10px",border:"1px solid #E2E8F0",textAlign:"left"}}>Mitarbeiter</th>
              <th style={{background:"#FEF9C3",padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center"}}>Feiertage</th>
              <th style={{background:"#FFF7ED",padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center"}}>Sonntage</th>
              <th style={{background:"#F8FAFC",padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center"}}>Pensum</th>
              <th style={{background:"#F0FDF4",padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center"}}>Soll</th>
            </tr></thead>
            <tbody>
              {employees.map(emp=>{
                const st=holidayStats?.[emp.id]||{hol:0,sun:0,holDates:[],sunDates:[]};
                const totalHols=Object.values(holidayStats||{}).reduce((a,v)=>a+(v.hol||0),0);
                const totalSuns=Object.values(holidayStats||{}).reduce((a,v)=>a+(v.sun||0),0);
                const sollHol=Math.round((emp.pensumPct/100)*(totalHols/employees.length));
                const sollSun=Math.round((emp.pensumPct/100)*(totalSuns/employees.length));
                const holOk=Math.abs(st.hol-sollHol)<=1,sunOk=Math.abs(st.sun-sollSun)<=1;
                const isExp=holSunExpanded===emp.id;
                return(
                  <Fragment key={emp.id}>
                    <tr onClick={()=>setHolSunExpanded(p=>p===emp.id?null:emp.id)} style={{cursor:"pointer"}}>
                      <td style={{padding:"5px 10px",border:"1px solid #E2E8F0",fontWeight:600}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:emp.color,display:"inline-block",marginRight:6,verticalAlign:"middle"}}/>
                        {emp.name} <span style={{fontSize:9,color:"var(--sc-text-3)"}}>{isExp?"▼":"▶"}</span>
                      </td>
                      <td style={{padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center",background:holOk?"#F0FDF4":"#FEF2F2",fontWeight:700,color:holOk?"#059669":"#DC2626"}}>{st.hol}</td>
                      <td style={{padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center",background:sunOk?"#F0FDF4":"#FEF2F2",fontWeight:700,color:sunOk?"#059669":"#DC2626"}}>{st.sun}</td>
                      <td style={{padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center",color:"#64748B"}}>{emp.pensumPct}%</td>
                      <td style={{padding:"5px 8px",border:"1px solid #E2E8F0",textAlign:"center",color:"#94A3B8",fontSize:10}}>~{sollHol} / ~{sollSun}</td>
                    </tr>
                    {isExp&&(
                      <tr><td colSpan={5} style={{padding:"8px 14px",border:"1px solid #E2E8F0",background:"var(--sc-subtle)"}}>
                        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                          <div>
                            <div style={{fontSize:10,fontWeight:700,marginBottom:4,color:"#92400E"}}>Feiertage ({st.hol})</div>
                            {st.holDates?.length?st.holDates.map(d=>{
                              const hMap2=getHolidaysByBL(planYear,care[0]?.bundesland||"BW");
                              return <div key={d} style={{fontSize:10,padding:"1px 0"}}>{d} – {hMap2[d]||"Feiertag"}</div>;
                            }):<div style={{fontSize:10,color:"var(--sc-text-3)"}}>Keine</div>}
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:700,marginBottom:4,color:"#C2410C"}}>Sonntage ({st.sun})</div>
                            {st.sunDates?.length?st.sunDates.map(d=><div key={d} style={{fontSize:10,padding:"1px 0"}}>{d}</div>):<div style={{fontSize:10,color:"var(--sc-text-3)"}}>Keine</div>}
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sc-card">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <div className="sc-h2" style={{marginBottom:0}}>💰 Lohnabrechnung – {MONTHS_DE[planMonth-1]} {planYear}</div>
          {allConf&&<span className="al al-ok" style={{padding:"4px 12px",marginBottom:0,fontSize:11,marginLeft:"auto"}}>✅ Alle bestätigt</span>}
        </div>
        <div className="al al-info" style={{marginBottom:8,fontSize:11}}>
          <strong>§3 EFZG:</strong> Bis 42 Tage = Lohnfortzahlung. <strong>§3b EStG:</strong> Zuschläge stundenscharf. <strong>§11 BUrlG:</strong> Urlaubsentgelt = Tage × Std/Tag × Stundensatz.
        </div>
        {employees.map(emp=>{
          const p=calcEmpPayroll(emp);
          const isConf=payrollConf[emp.id]?.[moStr];
          const overridesForEmp=payrollOverrides?.[`${emp.id}_${moStr}`]||[];
          const fields=[
            {k:"totalH",l:"Geleistete Stunden",v:`${p.totalH}h`},
            {k:"grundlohn",l:"Grundlohn",v:`${p.grundlohn.toFixed(2)} €`},
            {k:"holH",l:`Feiertag (${p.holH}h)`,v:`+ ${p.holS.toFixed(2)} €`},
            {k:"sunH",l:`Sonntag (${p.sunH}h)`,v:`+ ${p.sunS.toFixed(2)} €`},
            {k:"nightH",l:`Nacht (${p.nightH}h)`,v:`+ ${p.nightS.toFixed(2)} €`},
            {k:"vacDays",l:`Urlaub (${p.dailyH}h/Tag)`,v:`${p.vacDays} Tage = ${p.vacLohn.toFixed(2)} €`,note:true},
            {k:"sickDaysMonth",l:"Krank (Monat)",v:`${p.sickDaysMonth} Tage`,warn:p.sickDaysMonth>0},
            {k:"sickDaysYear",l:"Krank (Jahr kum.)",v:`${p.sickDaysYear}${p.sickDaysYear>=42?" ⚠️":""}`,warn:p.sickDaysYear>=42},
            {k:"takenOver",l:"Übernahmen",v:`+${p.takenOver}/-${p.gaveAway}`,note:true},
          ];
          return(
            <div key={emp.id} style={{marginBottom:14,background:"#F8FAFC",borderRadius:10,padding:14,border:`1px solid ${isConf?"#A7F3D0":"#E2E8F0"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:emp.color}}/>
                <span style={{fontWeight:700,fontSize:13}}>{emp.name}</span>
                <span style={{fontSize:11,color:"#94A3B8"}}>{emp.pensumPct}% · {emp.hourlyRate?.toFixed(2)}€/h · {p.dailyH}h/Tag</span>
                {isConf&&<span className="al al-ok" style={{padding:"2px 8px",marginBottom:0,fontSize:10,marginLeft:"auto"}}>✅</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5,marginBottom:10}}>
                {fields.map(item=>{
                  const ov=p.latestOverrides[item.k];
                  return(
                    <div key={item.k} style={{background:"#fff",borderRadius:6,padding:"6px 8px",border:`1px solid ${item.warn?"#FECACA":ov?"#BFDBFE":"#E2E8F0"}`,position:"relative"}}>
                      <div style={{fontSize:9,color:"#94A3B8",marginBottom:1}}>{item.l}</div>
                      <div style={{fontWeight:700,fontSize:11,color:item.warn?"#EF4444":item.note?"#6366F1":ov?"#1D4ED8":"#0F172A"}}>
                        {ov?<span title={`Angepasst: ${ov.reason}`}>{ov.newVal} <span style={{fontSize:9,color:"#94A3B8",textDecoration:"line-through"}}>{ov.oldVal}</span></span>:item.v}
                      </div>
                      {!isConf&&<button onClick={()=>setOverrideModal({empId:emp.id,field:item.k,curVal:ov?.newVal||item.v,label:item.l})}
                        style={{position:"absolute",top:2,right:2,background:"transparent",border:"none",cursor:"pointer",fontSize:9,color:"#CBD5E1",padding:1}}>✏️</button>}
                    </div>
                  );
                })}
              </div>
              {/* Manuelle Overrides anzeigen + rückgängig machen */}
              {overridesForEmp.length>0&&(
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#1D4ED8",marginBottom:4}}>📝 Manuelle Anpassungen:</div>
                  {overridesForEmp.map(ov=>(
                    <div key={ov.id} style={{fontSize:10,background:"#EFF6FF",borderRadius:5,padding:"3px 8px",marginBottom:3,display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{flex:1}}><strong>{ov.field}</strong>: {ov.oldVal} → {ov.newVal} · <em>{ov.reason}</em></span>
                      <button onClick={()=>undoPayrollOverride(emp.id,moStr,ov.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"#EF4444",fontSize:12}}>↩</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{background:"#0F172A",borderRadius:8,padding:"8px 14px",color:"#fff",fontSize:13,fontWeight:700}}>
                  Brutto: {p.brutto.toFixed(2)} €
                  <span style={{fontSize:10,opacity:.7,marginLeft:8}}>davon Urlaub {p.vacLohn.toFixed(2)} €</span>
                </div>
                <button className="sc-btn sc-btn-s" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>exportCSV(";",emp.id)} title="DATEV LODAS Import-Datei für diese Person">⬇️ LODAS CSV</button>
                {!isConf?(
                  <button className="sc-btn sc-btn-g" style={{marginLeft:"auto"}} onClick={()=>{setPayrollConf(prev=>({...prev,[emp.id]:{...prev[emp.id],[moStr]:true}}));addAudit?.("payroll_confirmed",`Lohnabrechnung ${emp.name} bestätigt`,moStr);}}>✅ Bestätigen</button>
                ):(
                  <button className="sc-btn sc-btn-s" style={{marginLeft:"auto",fontSize:10}} onClick={()=>{setPayrollConf(prev=>({...prev,[emp.id]:{...prev[emp.id],[moStr]:false}}));addAudit?.("payroll_unconfirmed",`Lohnabrechnung ${emp.name} aufgehoben`,moStr);}}>Aufheben</button>
                )}
              </div>
            </div>
          );
        })}
        <hr className="sc-div"/>
        {(()=>{
          const unreviewedCount=(shiftAdjustments||[]).filter(r=>r.date?.startsWith(moStr)&&r.status==="applied").length;
          const allPlanConf=(activeEmployees||employees).every(e=>{const c2=planConfirmations?.[`${e.id}_${moStr}`];return c2&&c2.planVersion===planVersions?.[moStr];});
          const missingConf=(activeEmployees||employees).filter(e=>{const c2=planConfirmations?.[`${e.id}_${moStr}`];return !c2||c2.planVersion!==planVersions?.[moStr];});
          return(
            <>
              {!allPlanConf&&(
                <div className="al al-warn" style={{marginBottom:10,fontSize:11}}>
                  <strong>Planbestätigung fehlt:</strong> {missingConf.map(e=>e.name).join(", ")} – Alle Mitarbeiter müssen den Plan im Plan-Tab bestätigen, bevor der Export möglich ist.
                </div>
              )}
              {unreviewedCount>0&&(
                <div className="al al-warn" style={{marginBottom:10,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{flex:1}}><strong>{unreviewedCount} Schichtänderung(en)</strong> noch nicht geprüft.</div>
                  <button className="sc-btn sc-btn-o" style={{fontSize:11}} onClick={()=>reviewMonthChanges?.(moStr)}>✓ Freigeben</button>
                </div>
              )}
              <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{fontSize:11,color:"#64748B"}}>
                  Exportiert 2 Dateien: <strong>LODAS-Import</strong> + <strong>Lohnjournal</strong>
                </div>
                <button className="sc-btn sc-btn-g" style={{marginLeft:"auto"}}
                  disabled={!allConf||unreviewedCount>0||!allPlanConf}
                  onClick={()=>{exportCSV(";");addAudit?.("lodas_exported",`LODAS + Lohnjournal ${MONTHS_DE[planMonth-1]} ${planYear} exportiert`,moStr);}}>
                  ⬇️ LODAS + Lohnjournal{!allConf?" (Lohn bestätigen)":!allPlanConf?" (Planbestätigung fehlt)":unreviewedCount>0?" (Änderungen prüfen)":""}
                </button>
              </div>
            </>
          );
        })()}
      </div>
      {/* Prüfprotokoll */}
      <div className="sc-card">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <div className="sc-h2" style={{marginBottom:0}}>Prüfprotokoll</div>
          <span style={{fontSize:10,color:"var(--sc-text-3)"}}>Revisionssicher · Timestamp + User-ID</span>
          <button className="sc-btn sc-btn-s" style={{marginLeft:"auto",fontSize:10}} onClick={()=>{
            const rows=[["Zeitstempel","User-ID","Benutzer","Rolle","Aktion","Details","Monat"],
              ...(auditLog||[]).map(e=>[e.ts,e.userId,e.userName,e.role,e.action,e.details,e.moStr])];
            const csv="\uFEFF"+rows.map(r=>r.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
            const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
            const url=URL.createObjectURL(blob);
            const a=document.createElement("a");a.href=url;a.download=`Pruefprotokoll_${planYear}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
            addAudit?.("audit_exported","Prüfprotokoll als CSV exportiert");
          }}>⬇️ CSV Export</button>
        </div>
        <div className="al al-info" style={{marginBottom:10,fontSize:10}}>
          Alle relevanten Aktionen werden automatisch protokolliert (Plan-Generierung, Schichtänderungen, Bestätigungen, Exporte). Dieses Protokoll dient als Nachweis gegenüber Finanzamt und Sozialversicherungsträgern.
        </div>
        <div style={{maxHeight:300,overflowY:"auto",border:"1px solid var(--sc-border)",borderRadius:8}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:10}}>
            <thead><tr style={{position:"sticky",top:0,background:"var(--sc-subtle)"}}>
              <th style={{padding:"4px 8px",border:"1px solid var(--sc-border)",textAlign:"left",fontWeight:700,minWidth:130}}>Zeitstempel</th>
              <th style={{padding:"4px 8px",border:"1px solid var(--sc-border)",textAlign:"left",fontWeight:700,minWidth:80}}>Benutzer</th>
              <th style={{padding:"4px 8px",border:"1px solid var(--sc-border)",textAlign:"left",fontWeight:700,minWidth:100}}>Aktion</th>
              <th style={{padding:"4px 8px",border:"1px solid var(--sc-border)",textAlign:"left",fontWeight:700}}>Details</th>
            </tr></thead>
            <tbody>
              {(auditLog||[]).filter(e=>!moStr||e.moStr===moStr||e.action==="plan_generated").slice(0,100).map(e=>(
                <tr key={e.id} style={{borderBottom:"1px solid var(--sc-border-2)"}}>
                  <td style={{padding:"3px 8px",border:"1px solid var(--sc-border)",fontFamily:"'JetBrains Mono',monospace",fontSize:9,whiteSpace:"nowrap"}}>{new Date(e.ts).toLocaleString("de-DE")}</td>
                  <td style={{padding:"3px 8px",border:"1px solid var(--sc-border)",fontWeight:600}}>{e.userName} <span style={{fontSize:8,color:"var(--sc-text-3)"}}>({e.role})</span></td>
                  <td style={{padding:"3px 8px",border:"1px solid var(--sc-border)",color:"var(--sc-accent)"}}>{e.action}</td>
                  <td style={{padding:"3px 8px",border:"1px solid var(--sc-border)",color:"var(--sc-text-2)"}}>{e.details}</td>
                </tr>
              ))}
              {!(auditLog||[]).length&&<tr><td colSpan={4} style={{padding:16,textAlign:"center",color:"var(--sc-text-3)",border:"1px solid var(--sc-border)"}}>Noch keine Einträge.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ── EINSTELLUNGEN TAB ─────────────────────────────────────────────
function SettingsTab({isAdmin,myEmp,user,passwords,setPasswords,appSettings,setAppSettings}){
  const empId=isAdmin?"admin":myEmp?.id;
  const currentPw=passwords[empId];
  const decoded=currentPw?atob(currentPw):null;
  const masked=decoded?decoded.slice(0,2)+"•".repeat(Math.max(0,decoded.length-2)):null;
  return(
    <div style={{maxWidth:560,margin:"0 auto"}}>
      {/* Passwort */}
      <div className="sc-card" style={{marginBottom:16}}>
        <div className="sc-h2">🔑 Mein Passwort</div>
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:12,color:"var(--sc-text-2)"}}>Aktuell:</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:"var(--sc-text)",
              background:"var(--sc-subtle)",padding:"4px 10px",borderRadius:6,border:"1px solid var(--sc-border)",letterSpacing:1}}>
              {masked||"0000"}
            </span>
            {!currentPw&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FEF9C3",color:"#92400E",border:"1px solid #FDE68A"}}>Standard</span>}
            {currentPw&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#DCFCE7",color:"#166534",border:"1px solid #A7F3D0"}}>Individuell</span>}
          </div>
        </div>
        <div className="lbl" style={{marginBottom:6}}>Neues Passwort setzen</div>
        <EmpPasswordSetter empId={empId} passwords={passwords} setPasswords={setPasswords}/>
        <div style={{fontSize:10,color:"var(--sc-text-3)",marginTop:8}}>
          Tipp: Wähle ein sicheres Passwort mit mindestens 4 Zeichen. Das Standardpasswort für neue Mitarbeiter ist <strong>0000</strong>.
        </div>
      </div>

      {/* Erscheinungsbild */}
      <div className="sc-card">
        <div className="sc-h2">🎨 Erscheinungsbild</div>
        <div style={{marginBottom:16}}>
          <div className="lbl" style={{marginBottom:8}}>Farbschema</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {[
              {id:"light",label:"Hell",preview:["#F8FAFC","#FFFFFF","#0EA5E9"]},
              {id:"dark",label:"Dunkel",preview:["#0F172A","#1E293B","#38BDF8"]},
              {id:"colorful",label:"Bunt",preview:["#FAFAF9","#FFFFFF","#8B5CF6"]},
            ].map(t=>(
              <button key={t.id} className={`theme-pill${appSettings.theme===t.id?" active":""}`}
                onClick={()=>setAppSettings(p=>({...p,theme:t.id}))}>
                <span style={{display:"flex",gap:2}}>
                  {t.preview.map((c,i)=><span key={i} style={{width:12,height:12,borderRadius:3,background:c,border:"1px solid rgba(0,0,0,.1)"}}/>)}
                </span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="lbl" style={{marginBottom:8}}>Emojis anzeigen</div>
          <div style={{display:"flex",gap:8}}>
            <button className={`theme-pill${appSettings.showEmojis?" active":""}`}
              onClick={()=>setAppSettings(p=>({...p,showEmojis:true}))}>
              <span>😊</span> Mit Emojis
            </button>
            <button className={`theme-pill${!appSettings.showEmojis?" active":""}`}
              onClick={()=>setAppSettings(p=>({...p,showEmojis:false}))}>
              <span style={{fontSize:14}}>Aa</span> Ohne Emojis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NOTFALL TAB ───────────────────────────────────────────────────
function NotfallTab({contacts}){
  return(
    <div style={{maxWidth:500,margin:"0 auto"}}>
      <div className="sc-card">
        <div className="sc-h2">🚨 Notfallkontakte</div>
        <div className="al al-err" style={{marginBottom:14,fontSize:12,padding:"10px 14px"}}>
          <strong>Im Notfall immer zuerst 112 anrufen!</strong>
        </div>
        {(!contacts||contacts.length===0)&&<div style={{textAlign:"center",padding:24,color:"var(--sc-text-3)",fontSize:13}}>Keine Kontakte hinterlegt. Admin kann unter Team & Setup Kontakte anlegen.</div>}
        <div className="sc-col" style={{gap:8}}>
          {(contacts||[]).map(c=>(
            <a key={c.id} href={`tel:${c.phone.replace(/\s/g,"")}`} style={{textDecoration:"none",display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"var(--sc-subtle)",borderRadius:12,border:"1px solid var(--sc-border)"}}>
              <div style={{width:44,height:44,borderRadius:12,background:"var(--sc-red-bg)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📞</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:"var(--sc-text)"}}>{c.name}</div>
                <div style={{fontSize:16,fontWeight:700,color:"var(--sc-accent)",fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{c.phone}</div>
                {c.note&&<div style={{fontSize:11,color:"var(--sc-text-3)",marginTop:2}}>{c.note}</div>}
              </div>
              <div style={{fontSize:20,color:"var(--sc-accent)",flexShrink:0}}>→</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HOW-TO TAB ────────────────────────────────────────────────────
function HowToTab({items,setItems,isAdmin}){
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({title:"",description:"",type:"text",youtubeUrl:"",imageData:null,fileName:""});
  const [editId,setEditId]=useState(null);
  const [filter,setFilter]=useState("all");
  const fileRef=useRef(null);
  const handleFile=(e)=>{
    const f=e.target.files?.[0];if(!f)return;
    if(f.size>5*1024*1024){alert("Max. 5 MB");return;}
    const reader=new FileReader();
    reader.onload=(ev)=>setForm(p=>({...p,imageData:ev.target.result,fileName:f.name,type:f.type.startsWith("video")?"video":"image"}));
    reader.readAsDataURL(f);
  };
  const extractYTId=(url)=>{if(!url)return null;const m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);return m?m[1]:null;};
  const save=()=>{
    if(!form.title)return;
    const entry={id:editId||Date.now(),title:form.title,description:form.description,type:form.type,youtubeUrl:form.youtubeUrl||"",imageData:form.imageData,fileName:form.fileName,createdAt:editId?items.find(i=>i.id===editId)?.createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(editId) setItems(p=>p.map(i=>i.id===editId?entry:i));
    else setItems(p=>[entry,...p]);
    setForm({title:"",description:"",type:"text",youtubeUrl:"",imageData:null,fileName:""});
    setShowForm(false);setEditId(null);
  };
  const startEdit=(item)=>{setForm({title:item.title,description:item.description,type:item.type,youtubeUrl:item.youtubeUrl||"",imageData:item.imageData,fileName:item.fileName||""});setEditId(item.id);setShowForm(true);};
  const filtered=filter==="all"?items:items.filter(i=>i.type===filter);
  return(
    <div style={{maxWidth:800,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div className="sc-h2" style={{marginBottom:0}}>How-To</div>
        {isAdmin&&<button className="sc-btn sc-btn-p" style={{marginLeft:"auto",fontSize:11}} onClick={()=>{setShowForm(p=>!p);setEditId(null);setForm({title:"",description:"",type:"text",youtubeUrl:"",imageData:null,fileName:""});}}>{showForm?"Schliessen":"+ Neuer Eintrag"}</button>}
      </div>
      {isAdmin&&showForm&&<div className="sc-card" style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>{editId?"Bearbeiten":"Neuer Eintrag"}</div>
        <div className="sc-col" style={{gap:10}}>
          <div><div className="lbl">Titel</div><input className="sc-input" style={{width:"100%"}} value={form.title} placeholder="z.B. Schichtplan erstellen" onChange={e=>setForm(p=>({...p,title:e.target.value}))}/></div>
          <div><div className="lbl">Beschreibung</div><textarea className="sc-input" style={{width:"100%",minHeight:80,resize:"vertical"}} value={form.description} placeholder="Anleitung..." onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
          <div><div className="lbl">Typ</div><div style={{display:"flex",gap:6}}>
            {[{k:"text",l:"Text"},{k:"image",l:"Bild"},{k:"youtube",l:"YouTube"}].map(({k,l})=>(
              <button key={k} className={`sc-btn ${form.type===k?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:11}} onClick={()=>setForm(p=>({...p,type:k}))}>{l}</button>
            ))}
          </div></div>
          {form.type==="image"&&<div><div className="lbl">Bild (max 5MB)</div><input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{fontSize:12}}/>{form.imageData&&<img src={form.imageData} alt="" style={{maxWidth:200,maxHeight:150,borderRadius:8,marginTop:8,border:"1px solid var(--sc-border)"}}/>}</div>}
          {form.type==="youtube"&&<div><div className="lbl">YouTube-URL</div><input className="sc-input" style={{width:"100%"}} value={form.youtubeUrl} placeholder="https://youtube.com/watch?v=..." onChange={e=>setForm(p=>({...p,youtubeUrl:e.target.value}))}/>{extractYTId(form.youtubeUrl)&&<div style={{marginTop:8,borderRadius:8,overflow:"hidden",maxWidth:360}}><iframe width="100%" height="200" src={`https://www.youtube-nocookie.com/embed/${extractYTId(form.youtubeUrl)}`} frameBorder="0" allowFullScreen style={{borderRadius:8}}/></div>}</div>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end"}}>
          <button className="sc-btn sc-btn-s" onClick={()=>{setShowForm(false);setEditId(null);}}>Abbrechen</button>
          <button className="sc-btn sc-btn-g" onClick={save} disabled={!form.title}>{editId?"Speichern":"Hinzufuegen"}</button>
        </div>
      </div>}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        {[{k:"all",l:"Alle"},{k:"text",l:"Text"},{k:"image",l:"Bilder"},{k:"youtube",l:"Videos"}].map(({k,l})=>(
          <button key={k} className={`sc-btn ${filter===k?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setFilter(k)}>{l} ({k==="all"?items.length:items.filter(i=>i.type===k).length})</button>
        ))}
      </div>
      {filtered.length===0&&<div className="sc-card" style={{textAlign:"center",padding:32,color:"var(--sc-text-3)",fontSize:13}}>{items.length===0?"Noch keine Anleitungen.":"Keine Eintraege."}</div>}
      <div className="sc-col" style={{gap:12}}>
        {filtered.map(item=>(
          <div key={item.id} className="sc-card" style={{padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{item.title}</div>
                {item.description&&<div style={{fontSize:12,color:"var(--sc-text-2)",whiteSpace:"pre-wrap",lineHeight:1.5,marginBottom:10}}>{item.description}</div>}
                {item.type==="image"&&item.imageData&&<img src={item.imageData} alt={item.title} style={{maxWidth:"100%",maxHeight:400,borderRadius:8,border:"1px solid var(--sc-border)"}}/>}
                {item.type==="youtube"&&extractYTId(item.youtubeUrl)&&<div style={{borderRadius:8,overflow:"hidden",maxWidth:480}}><iframe width="100%" height="270" src={`https://www.youtube-nocookie.com/embed/${extractYTId(item.youtubeUrl)}`} frameBorder="0" allowFullScreen style={{borderRadius:8}}/></div>}
                <div style={{fontSize:10,color:"var(--sc-text-3)",marginTop:6}}>{new Date(item.createdAt).toLocaleDateString("de-DE")}</div>
              </div>
              {isAdmin&&<div style={{display:"flex",gap:4,flexShrink:0}}>
                <button className="sc-btn sc-btn-s" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>startEdit(item)}>Bearbeiten</button>
                <button onClick={()=>setItems(p=>p.filter(x=>x.id!==item.id))} style={{background:"transparent",border:"1px solid #FECACA",borderRadius:6,cursor:"pointer",color:"var(--sc-red)",fontSize:12,padding:"3px 7px"}}>x</button>
              </div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsTab({notifications,setNotifications,isAdmin,myEmp,setTab}){
  const NOTIF_TAB_MAP={vacation_overlap:"abwesenheit",sick_submitted:"abwesenheit",sick_confirmed:"abwesenheit",vacation_decided:"abwesenheit",shift_changed:"plan",plan_published:"plan",shift_open:"plan",shift_taken:"plan"};
  const markAll=()=>setNotifications(p=>p.map(n=>({...n,read:true})));
  const [filter,setFilter]=useState("all");
  const relevant=isAdmin?notifications:notifications.filter(n=>!n.empIds?.length||n.empIds.includes(myEmp?.id));
  const groups={shifts:{label:"Schichten",types:["shift_changed","shift_open","shift_taken"],icon:"\u{1F4CB}"},
    vacation:{label:"Abwesenheit",types:["vacation_overlap","vacation_decided","sick_submitted","sick_confirmed"],icon:"\u{1F3D6}"},
    system:{label:"System",types:["plan_published"],icon:"\u2699"}};
  const filtered=filter==="all"?relevant:relevant.filter(n=>groups[filter]?.types.includes(n.type));
  return(
    <div style={{maxWidth:640,margin:"0 auto"}}>
      <div className="sc-card">
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
          <div className="sc-h2" style={{marginBottom:0}}>Benachrichtigungen</div>
          <button className="sc-btn sc-btn-s" style={{marginLeft:"auto",fontSize:11}} onClick={markAll}>Alle gelesen</button>
          {isAdmin&&<button className="sc-btn sc-btn-r" style={{fontSize:11}} onClick={()=>setNotifications([])}>Löschen</button>}
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          <button className={`sc-btn ${filter==="all"?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setFilter("all")}>
            Alle ({relevant.filter(n=>!n.read).length})</button>
          {Object.entries(groups).map(([k,g])=>{
            const cnt=relevant.filter(n=>!n.read&&g.types.includes(n.type)).length;
            return <button key={k} className={`sc-btn ${filter===k?"sc-btn-p":"sc-btn-s"}`} style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setFilter(f=>f===k?"all":k)}>
              {g.icon} {g.label}{cnt>0?` (${cnt})`:""}</button>;
          })}
        </div>
        {filtered.length===0&&<div style={{textAlign:"center",padding:32,color:"var(--sc-text-3)",fontSize:13}}>Keine Benachrichtigungen.</div>}
        {filtered.map(n=>{const nt=NOTIF_TYPES[n.type]||{icon:"\u{1F4E2}",color:"#64748B"};return(
          <div key={n.id} className={`notif-item${n.read?"":" unread"}`} style={{cursor:"pointer"}} onClick={()=>{setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x));const target=NOTIF_TAB_MAP[n.type];if(target)setTab(target);}}>
            <div style={{width:32,height:32,borderRadius:8,background:nt.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{nt.icon}</div>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:n.read?400:700}}>{n.message}</div><div style={{fontSize:10,color:"var(--sc-text-3)",marginTop:2}}>{n.date}</div></div>
            {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:"var(--sc-accent)",flexShrink:0}}/>}
          </div>
        );})}
      </div>
    </div>
  );
}

