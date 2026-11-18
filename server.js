const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const QRCode=require('qrcode');
const crypto=require('crypto');
const path=require('path');
const app=express();app.set('trust proxy',1);const server=http.createServer(app);const io=new Server(server,{pingTimeout:25000});
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(_,res)=>res.json({ok:true}));
const rooms=new Map();
const code=()=>String(100000+crypto.randomInt(900000));
const token=()=>crypto.randomBytes(20).toString('hex');
const clean=s=>String(s||'').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,24);
function hostView(r){return {code:r.code,phase:r.phase,lesson:r.lesson,question:r.question,players:[...r.players.values()].map(p=>({name:p.name,score:p.score,online:!!p.socketId,answered:r.answers.has(p.id)})),answers:[...r.answers.values()],decisionAnswers:[...r.decisionAnswers.values()],started:r.started,seconds:r.seconds,deadline:r.deadline};}
function playerView(r,p){return {code:r.code,phase:r.phase,lesson:r.lesson,question:r.question,score:p.score,name:p.name,answered:r.answers.has(p.id),decisionAnswered:r.decisionAnswers.has(p.id),decisionChoice:r.decisionAnswers.get(p.id)?.choice,decisionCorrect:r.phase==='decision-reveal'?DATA.lessons[r.lesson].decision.correct:null,myAnswer:r.answers.get(p.id)?.choice,correct:r.phase==='reveal'?r.revealCorrect:null,leaderboard:r.phase==='results'?[...r.players.values()].sort((a,b)=>b.score-a.score).map(p=>({name:p.name,score:p.score})):null,deadline:r.deadline};}
function broadcast(r){if(r.hostSocket)io.to(r.hostSocket).emit('state',hostView(r));for(const p of r.players.values())if(p.socketId)io.to(p.socketId).emit('state',playerView(r,p));}
function fail(cb,msg){if(typeof cb==='function')cb({ok:false,error:msg});}
function ok(cb,obj={}){if(typeof cb==='function')cb({ok:true,...obj});}
function roomForHost(s){const r=rooms.get(s.data.code);return r&&r.hostToken===s.data.hostToken?r:null;}
function roomForPlayer(s){const r=rooms.get(s.data.code);const p=r?.players.get(s.data.playerId);return r&&p&&p.token===s.data.playerToken?{r,p}:null;}
function endDecision(r){if(r.phase!=='decision')return;r.phase='decision-reveal';r.deadline=null;r.timer=null;broadcast(r);}
function endQuestion(r){if(r.phase!=='question')return;r.phase='reveal';r.deadline=null;r.revealCorrect=require('./public/content-server.json').questions[r.question].c;broadcast(r);}
const DATA=require('./public/content-server.json');
io.on('connection',socket=>{
 socket.on('sync-clock',(cb)=>{if(typeof cb==='function')cb({serverNow:Date.now()});});
 socket.on('create-room',(cb)=>{let c;do{c=code()}while(rooms.has(c));const r={code:c,hostToken:token(),hostSocket:socket.id,players:new Map(),phase:'lobby',lesson:0,question:0,answers:new Map(),decisionAnswers:new Map(),started:false,deadline:null,seconds:25,timer:null,revealCorrect:null};rooms.set(c,r);socket.data={code:c,hostToken:r.hostToken};ok(cb,{code:c,hostToken:r.hostToken});broadcast(r);});
 socket.on('resume-host',({code,hostToken},cb)=>{const r=rooms.get(String(code));if(!r||r.hostToken!==hostToken)return fail(cb,'Host session not found. Create a new game if the server restarted.');r.hostSocket=socket.id;socket.data={code:r.code,hostToken};ok(cb);broadcast(r);});
 socket.on('join',({code,name,playerToken},cb)=>{const r=rooms.get(String(code));if(!r)return fail(cb,'Room not found. Check the 6-digit code.');if(r.phase==='results')return fail(cb,'This game has already ended.');let p=[...r.players.values()].find(x=>x.token===playerToken&&playerToken);if(!p){if(r.started)return fail(cb,'The game already started. Ask the host to restart.');name=clean(name);if(!name)return fail(cb,'Enter a nickname.');if([...r.players.values()].some(x=>x.name.toLowerCase()===name.toLowerCase()))return fail(cb,'That nickname is already taken.');p={id:token(),token:token(),name,score:0,socketId:null};r.players.set(p.id,p);}p.socketId=socket.id;socket.data={code:r.code,playerId:p.id,playerToken:p.token};ok(cb,{playerToken:p.token,code:r.code});broadcast(r);});
 socket.on('host-action',({action,value},cb)=>{const r=roomForHost(socket);if(!r)return fail(cb,'Only the host can control the game.');clearTimeout(r.timer);r.timer=null;r.deadline=null;
 if(action==='start'){r.started=true;r.phase='lesson';r.lesson=0;r.question=0;}
 else if(action==='lesson'){r.phase='lesson';r.lesson=Math.max(0,Math.min(DATA.lessons.length-1,Number(value)||0));}
 else if(action==='decision'){r.phase='decision';r.decisionAnswers.clear();r.deadline=Date.now()+20000;r.timer=setTimeout(()=>endDecision(r),20000);}
 else if(action==='decision-reveal'){if(r.phase!=='decision')return fail(cb,'No active survival vote.');r.phase='decision-reveal';}
 else if(action==='decision-back'){r.phase='decision';r.decisionAnswers.clear();r.deadline=Date.now()+20000;r.timer=setTimeout(()=>endDecision(r),20000);}
 else if(action==='next-lesson'){if(r.phase!=='decision-reveal')return fail(cb,'Reveal the class vote before moving on.');if(r.lesson<DATA.lessons.length-1){r.lesson++;r.phase='lesson';}else{r.phase='quiz-intro';}}
 else if(action==='quiz-intro'){r.phase='quiz-intro';}
 else if(action==='ask'){r.phase='question';r.answers.clear();r.revealCorrect=null;r.seconds=Math.max(10,Math.min(90,Number(value)||25));r.deadline=Date.now()+r.seconds*1000;r.timer=setTimeout(()=>endQuestion(r),r.seconds*1000);}
 else if(action==='reveal'){if(r.phase!=='question')return fail(cb,'No active question.');endQuestion(r);ok(cb);return;}
 else if(action==='next-question'){if(r.phase!=='reveal')return fail(cb,'Reveal the answer first.');if(r.question<DATA.questions.length-1){r.question++;r.phase='question';r.answers.clear();r.revealCorrect=null;r.seconds=25;r.deadline=Date.now()+25000;r.timer=setTimeout(()=>endQuestion(r),25000);}else{r.phase='results';}}
 else if(action==='home'){r.phase='lobby';r.started=false;r.lesson=0;r.question=0;r.answers.clear();r.decisionAnswers.clear();for(const p of r.players.values())p.score=0;}
 else if(action==='restart'){r.phase='lobby';r.started=false;r.lesson=0;r.question=0;r.answers.clear();r.decisionAnswers.clear();for(const p of r.players.values())p.score=0;}
 else return fail(cb,'Unknown action.');ok(cb);broadcast(r);});
 socket.on('decision-vote',({choice},cb)=>{const x=roomForPlayer(socket);if(!x)return fail(cb,'Please join the game.');const {r,p}=x;if(r.phase!=='decision'||!r.deadline||Date.now()>=r.deadline)return fail(cb,'Voting has closed.');if(r.decisionAnswers.has(p.id))return fail(cb,'Your vote is already locked in.');choice=Number(choice);const d=DATA.lessons[r.lesson].decision;if(!Number.isInteger(choice)||choice<0||choice>=d.options.length)return fail(cb,'Invalid choice.');r.decisionAnswers.set(p.id,{id:p.id,name:p.name,choice});ok(cb);broadcast(r);});
 socket.on('answer',({choice},cb)=>{const x=roomForPlayer(socket);if(!x)return fail(cb,'Please join the game.');const {r,p}=x;if(r.phase!=='question'||!r.deadline||Date.now()>r.deadline)return fail(cb,'Question closed.');if(r.answers.has(p.id))return fail(cb,'Answer already submitted.');choice=Number(choice);if(!Number.isInteger(choice)||choice<0||choice>3)return fail(cb,'Invalid answer.');const correct=choice===DATA.questions[r.question].c;const remaining=Math.max(0,r.deadline-Date.now());const points=correct?100+Math.floor(remaining/r.seconds/1000*50):0;p.score+=points;r.answers.set(p.id,{id:p.id,name:p.name,choice,correct,points});ok(cb,{points});broadcast(r);if(r.players.size>0&&[...r.players.values()].every(p=>r.answers.has(p.id))) {clearTimeout(r.timer);r.timer=setTimeout(()=>endQuestion(r),800);} });
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.code);if(!r)return;if(r.hostSocket===socket.id)r.hostSocket=null;const p=r.players.get(socket.data.playerId);if(p&&p.socketId===socket.id)p.socketId=null;broadcast(r);});
});
app.get('/api/qr/:code',async(req,res)=>{const r=rooms.get(req.params.code);if(!r)return res.status(404).send('Room not found');try{const url=`${req.protocol}://${req.get('host')}/?join=${encodeURIComponent(r.code)}`;res.type('png').send(await QRCode.toBuffer(url,{width:400,margin:2,errorCorrectionLevel:'M'}));}catch(e){res.status(500).send('QR error');}});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Red Panda live game listening on '+(process.env.PORT||3000)));
