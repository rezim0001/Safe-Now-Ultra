/* script.js - core logic for SafeNow Ultra */
/* Note: this file assumes running over HTTPS for full functionality */

const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');

function log(msg){ const p = document.createElement('div'); p.innerHTML = msg; logEl.prepend(p); statusEl.textContent = 'active'; }
function isHTTPS(){ return location.protocol === 'https:' || location.hostname === 'localhost'; }

/* Permissions helper */
async function checkPermissions(){
  const results=[];
  try{ await navigator.permissions?.query?.({name:'geolocation'}).then(r=>results.push('geo: '+r.state)).catch(()=>results.push('geo: unknown')) }catch(e){ results.push('geo: unknown') }
  try{ await navigator.permissions?.query?.({name:'microphone'}).then(r=>results.push('mic: '+r.state)).catch(()=>results.push('mic: unknown')) }catch(e){ results.push('mic: unknown') }
  try{ await navigator.permissions?.query?.({name:'camera'}).then(r=>results.push('cam: '+r.state)).catch(()=>results.push('cam: unknown')) }catch(e){ results.push('cam: unknown') }
  results.push('secure:'+isHTTPS());
  document.getElementById('perms').textContent = results.join(' • ');
  log('Permission check: '+results.join(' | '));
}
document.getElementById('checkPerms').onclick = checkPermissions;

/* SOS */
let sosTimer=null;
const SOS_COUNT = 3;
const emergencyNumber = '112';
document.getElementById('sosMain').addEventListener('mousedown', startSosCountdown);
document.getElementById('sosMain').addEventListener('touchstart', startSosCountdown, {passive:true});
document.getElementById('sosMain').addEventListener('mouseup', cancelSosCountdown);
document.getElementById('sosMain').addEventListener('touchend', cancelSosCountdown, {passive:true});

function startSosCountdown(e){ e.preventDefault?.(); let t=SOS_COUNT; document.getElementById('sosMain').textContent=t; sosTimer=setInterval(()=>{ t--; if(t>0) document.getElementById('sosMain').textContent=t; else { clearInterval(sosTimer); sosTimer=null; document.getElementById('sosMain').textContent='SOS'; triggerSos(); } },1000); log('SOS countdown started'); }
function cancelSosCountdown(){ if(sosTimer){ clearInterval(sosTimer); sosTimer=null; document.getElementById('sosMain').textContent='SOS'; log('SOS cancelled'); } }
async function triggerSos(){ try{ navigator.vibrate?.([200,100,200,100,200]); }catch(e){} log('<b>🚨 SOS TRIGGERED</b>'); const coords = await getCurrentLocation(10000); const locText = coords ? `Lat:${coords.latitude.toFixed(5)}, Lon:${coords.longitude.toFixed(5)}` : 'Location unavailable'; log('Location: '+locText); playSiren(0.8,700,0.3); const smsBody = encodeURIComponent(`SOS! I need help. My location: ${coords ? `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}` : 'unknown'}`); log(`<div style="margin-top:8px"><a href="sms:?body=${smsBody}" style="color:var(--accent)">Open SMS</a> • <a href="tel:${emergencyNumber}" style="color:var(--accent)">Call ${emergencyNumber}</a></div>`); }

/* Location helper */
async function getCurrentLocation(timeout=10000){ if(!navigator.geolocation){ log('Geolocation not supported'); return null; } return new Promise(resolve=>{ let settled=false; const timer=setTimeout(()=>{ if(!settled){ settled=true; log('Location timed out'); resolve(null); } }, timeout); navigator.geolocation.getCurrentPosition(pos=>{ if(settled) return; settled=true; clearTimeout(timer); resolve(pos.coords); }, err=>{ if(settled) return; settled=true; clearTimeout(timer); log('Location error: '+err.message); resolve(null); }, {enableHighAccuracy:true, maximumAge:5000, timeout:timeout}); }); }

/* WhatsApp share */
const whatsappNumber = '';
document.getElementById('shareWhats').onclick = async ()=>{ const coords = await getCurrentLocation(12000); const link = coords ? `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}` : 'Location unavailable'; const url = whatsappNumber ? `https://wa.me/${encodeURIComponent(whatsappNumber)}?text=${encodeURIComponent('Emergency! My location: '+link)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent('Emergency! My location: '+link)}`; window.open(url,'_blank'); log('WhatsApp share opened'); };

/* Nearby police */
document.getElementById('nearbyPolice').onclick = async ()=>{ const coords = await getCurrentLocation(12000); if(coords){ const maps = `https://www.google.com/maps/search/police+station/@${coords.latitude},${coords.longitude},14z`; window.open(maps,'_blank'); } else { window.open('https://www.google.com/maps/search/police+station','_blank'); } }

/* Shake-to-SOS */
let shakeEnabled=false; const SHAKE_THRESHOLD=18; let lastShakeTime=0;
function handleMotionForShake(e){ const a=e.accelerationIncludingGravity||e.acceleration; if(!a) return; const x=a.x||0,y=a.y||0,z=a.z||0; const magnitude=Math.sqrt(x*x+y*y+z*z); if(magnitude>SHAKE_THRESHOLD){ const now=Date.now(); if(now-lastShakeTime>3000){ lastShakeTime=now; log('Shake detected (mag='+magnitude.toFixed(1)+')'); triggerSos(); } } }
document.getElementById('shakeToggle').addEventListener('change',(e)=>{ shakeEnabled=e.target.checked; if(shakeEnabled){ if(typeof DeviceMotionEvent!=='undefined' && typeof DeviceMotionEvent.requestPermission==='function'){ DeviceMotionEvent.requestPermission().then(res=>{ if(res==='granted'){ window.addEventListener('devicemotion', handleMotionForShake); log('Shake-to-SOS enabled'); } else { log('Shake permission denied'); } }).catch(()=> log('Shake permission not available')); } else { window.addEventListener('devicemotion', handleMotionForShake); log('Shake-to-SOS enabled'); } } else { window.removeEventListener('devicemotion', handleMotionForShake); log('Shake-to-SOS disabled'); } });

/* Safe Walk */
let safeWalkInterval=null, safeWalkPrev=null, safeWalkOpts={interval:10000, stopThreshold:30};
function startSafeWalk(){ if(safeWalkInterval){ log('SafeWalk already running'); return; } safeWalkPrev=null; safeWalkInterval=setInterval(async ()=>{ const coords = await getCurrentLocation(8000); if(!coords){ log('SafeWalk: unable to read location'); return; } log(`SafeWalk ping: ${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)} acc:${Math.round(coords.accuracy)}m`); if(safeWalkPrev){ const dist = distanceMeters(safeWalkPrev.latitude,safeWalkPrev.longitude,coords.latitude,coords.longitude); log('SafeWalk: moved '+Math.round(dist)+'m since last ping'); if(dist < safeWalkOpts.stopThreshold){ log('<b style="color:var(--danger)">SafeWalk: movement stopped — sending alert</b>'); triggerSos(); } } safeWalkPrev=coords; }, safeWalkOpts.interval); log('SafeWalk started'); }
function stopSafeWalk(){ if(safeWalkInterval){ clearInterval(safeWalkInterval); safeWalkInterval=null; log('SafeWalk stopped'); } }
document.getElementById('startSafeWalk').onclick = startSafeWalk;
document.getElementById('stopSafeWalk').onclick = stopSafeWalk;
function distanceMeters(lat1,lon1,lat2,lon2){ function toRad(x){ return x*Math.PI/180; } const R=6371000; const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1); const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2); const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); return R*c; }

/* Flashlight strobe */
let trackForTorch=null, torchInterval=null;
async function startTorchStream(){ try{ const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); trackForTorch = stream.getVideoTracks()[0]; return true; }catch(e){ log('Torch: camera permission denied or unavailable: '+e.message); return false; } }
async function startStrobe(){ if(!trackForTorch){ const ok = await startTorchStream(); if(!ok) return; } try{ const supportTorch = trackForTorch.getCapabilities && trackForTorch.getCapabilities().torch; if(supportTorch){ torchInterval = setInterval(()=>{ const on = (Math.random()>0.5); try{ trackForTorch.applyConstraints({advanced:[{torch:on}]}); }catch(e){} },300); log('Torch strobe started (capability-based)'); } else { torchInterval = setInterval(()=>{ try{ trackForTorch.enabled = !trackForTorch.enabled; }catch(e){} },300); log('Torch strobe started (on/off fallback)'); } }catch(e){ log('Torch strobe error: '+e.message); } }
function stopStrobe(){ if(torchInterval){ clearInterval(torchInterval); torchInterval=null; } if(trackForTorch){ try{ trackForTorch.stop(); trackForTorch=null; }catch(e){} } log('Torch strobe stopped'); }
document.getElementById('flashOn').onclick = startStrobe;
document.getElementById('flashOff').onclick = stopStrobe;

/* Siren */
let audioCtx=null, sirenNode=null;
function playSiren(volume=0.12, baseFreq=700){ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(sirenNode) return; const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type='sawtooth'; o.frequency.value=baseFreq; o.connect(g); g.connect(audioCtx.destination); o.start(); const lfo=audioCtx.createOscillator(); lfo.frequency.value=1.6; const lfoGain=audioCtx.createGain(); lfoGain.gain.value=200; lfo.connect(lfoGain); lfoGain.connect(o.frequency); lfo.start(); g.gain.linearRampToValueAtTime(volume, audioCtx.currentTime+0.05); sirenNode={osc:o,gain:g,lfo:lfo}; log('Siren playing'); }
function stopSiren(){ if(!sirenNode) return; try{ sirenNode.gain.gain.linearRampToValueAtTime(0,audioCtx.currentTime+0.02); sirenNode.osc.stop(audioCtx.currentTime+0.03); sirenNode.lfo.stop(audioCtx.currentTime+0.03); }catch(e){} sirenNode=null; log('Siren stopped'); }
document.getElementById('sirenOn').onclick = ()=>{ playSiren(); };
document.getElementById('sirenOff').onclick = ()=>{ stopSiren(); };

/* Fake call modal */
document.getElementById('fakeCallBtn').onclick = ()=>{ const modal=document.getElementById('fakeModal'); modal.style.display='block'; const ringtone=new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'); ringtone.loop=true; ringtone.play().catch(()=> log('Ringtone blocked - tap to allow audio')); modal.dataset.ringtone = ringtone; };
document.getElementById('acceptFake').onclick = ()=>{ const modal=document.getElementById('fakeModal'); try{ const r=modal.dataset.ringtone; r.pause&&r.pause(); }catch(e){} modal.style.display='none'; log('Fake call accepted (simulation)'); };
document.getElementById('declineFake').onclick = ()=>{ const modal=document.getElementById('fakeModal'); try{ const r=modal.dataset.ringtone; r.pause&&r.pause(); }catch(e){} modal.style.display='none'; log('Fake call declined'); };

/* Voice trigger */
let voiceStream=null, voiceAnalyser=null, voiceRAF=null;
document.getElementById('voiceToggle').addEventListener('change', async (e)=>{ if(e.target.checked){ try{ voiceStream = await navigator.mediaDevices.getUserMedia({audio:true}); const ctx = new (window.AudioContext||window.webkitAudioContext)(); const src = ctx.createMediaStreamSource(voiceStream); const analyser = ctx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser); const data = new Uint8Array(analyser.frequencyBinCount); voiceAnalyser={ctx,analyser,data}; function loop(){ voiceAnalyser.analyser.getByteTimeDomainData(voiceAnalyser.data); let sum=0; for(let i=0;i<voiceAnalyser.data.length;i++){ const v=(voiceAnalyser.data[i]-128)/128; sum+=v*v; } const rms = Math.sqrt(sum/voiceAnalyser.data.length); if(rms>0.25){ log('Voice trigger detected (rms='+rms.toFixed(2)+')'); triggerSos(); } voiceRAF = requestAnimationFrame(loop); } loop(); log('Voice trigger enabled'); }catch(e){ log('Voice trigger error: '+e.message); document.getElementById('voiceToggle').checked=false; } } else { if(voiceRAF) cancelAnimationFrame(voiceRAF); if(voiceAnalyser){ voiceAnalyser.ctx.close().catch(()=>{}); voiceAnalyser=null; } if(voiceStream) voiceStream.getTracks().forEach(t=>t.stop()); voiceStream=null; log('Voice trigger disabled'); } });

/* Battery saver */
document.getElementById('batterySaver').addEventListener('change',(e)=>{ if(e.target.checked){ stopSiren(); stopStrobe(); stopSafeWalk(); log('Battery saver enabled: heavy features paused'); } else { log('Battery saver disabled'); } });

/* Open settings */
document.getElementById('openSettings').onclick = ()=>{ alert('To fix permissions: open your phone Settings → Apps → Chrome (or browser) → Permissions. Also ensure site is served over HTTPS.'); };

/* Initialization */
(async function init(){ if(!(location.protocol==='https:'||location.hostname==='localhost')){ log('⚠ This app works best over HTTPS. Some permissions may be blocked on HTTP or file://'); } if('serviceWorker' in navigator){ try{ await navigator.serviceWorker.register('/service-worker.js'); log('Service worker registered (if file exists on server).'); }catch(e){ log('Service worker registration failed or missing: '+e.message); } } await checkPermissions(); })();

/* expose some functions */
window.triggerSos = triggerSos;
window.playSiren = playSiren;
window.stopSiren = stopSiren;
window.getCurrentLocation = getCurrentLocation;
