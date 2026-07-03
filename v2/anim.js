/* Universal Fit — animaciones de técnica (stick figure) por ejercicio.
   Sin dependencias, SVG + SMIL: funcionan offline y en cualquier celular.
   exerciseAnim(name) devuelve el HTML de la demo (video-box) + guía de técnica.
   Se usa en videoBox() cuando el ejercicio no tiene un video propio del profe. */
(function(){
  var SS='<style>.lm{stroke:#eef4f2;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;fill:none}.em{stroke:#58cc02;stroke-width:6.5;stroke-linecap:round;stroke-linejoin:round;fill:none}.hd{fill:#eef4f2}.eq{stroke:#c2d0d8;stroke-width:5;stroke-linecap:round;fill:none}.wt{fill:#c2d0d8}.gr{stroke:#5b6b75;stroke-width:3;stroke-linecap:round}.gd{stroke:#58cc02;stroke-width:2;stroke-dasharray:3 4;fill:none;opacity:.75}.ar{fill:#58cc02;opacity:.9}</style>';
  function AT(type,vals,dur){return '<animateTransform attributeName="transform" type="'+type+'" values="'+vals+'" dur="'+(dur||'2s')+'" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"/>';}
  function head(cx,cy){return '<circle class="hd" cx="'+cx+'" cy="'+cy+'" r="11"/>';}
  function ln(x1,y1,x2,y2,c){return '<line class="'+(c||'lm')+'" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"/>';}
  function updown(){return '<g class="ar"><path d="M223 78 l-6 0 3 -7 z"/><path d="M223 112 l-6 0 3 7 z"/><line x1="220" y1="80" x2="220" y2="110" stroke="#58cc02" stroke-width="2" opacity=".6"/></g>';}
  function svg(inner){return '<svg viewBox="0 0 240 190" preserveAspectRatio="xMidYMid meet" style="position:absolute;inset:0;width:100%;height:100%">'+SS+'<line class="gr" x1="24" y1="176" x2="216" y2="176"/>'+inner+'</svg>';}

  var P={};
  P.squat={t:'Sentadilla',svg:'<g>'+AT('translate','0 0;0 26;0 0','2.1s')+head(112,44)+ln(112,55,112,104)+ln(90,66,134,66,'eq')+'<circle class="wt" cx="88" cy="66" r="6"/><circle class="wt" cx="136" cy="66" r="6"/>'+ln(112,66,96,80)+ln(112,66,128,80)+ln(112,104,98,138)+ln(98,138,104,176)+ln(112,104,128,140)+ln(128,140,120,176)+'</g>'+updown()};
  P.hinge={t:'Bisagra de cadera',svg:ln(112,104,100,150)+ln(100,150,100,176)+ln(112,104,124,150)+ln(124,150,124,176)+'<g>'+AT('rotate','0 112 104;62 112 104;0 112 104','2.2s')+ln(112,104,112,52,'em')+head(112,41)+ln(112,60,120,96)+ln(112,60,104,96)+ln(100,96,124,96,'eq')+'<circle class="wt" cx="98" cy="96" r="6"/><circle class="wt" cx="126" cy="96" r="6"/>'+'</g>'};
  P.kneeiso={t:'Trabajo de rodilla',svg:head(150,52)+ln(150,63,120,120)+ln(150,70,168,96)+ln(120,120,96,120,'eq')+'<g>'+AT('rotate','0 120 120;-58 120 120;0 120 120','1.9s')+ln(120,120,120,158,'em')+ln(120,158,138,168,'em')+'<circle class="wt" cx="120" cy="160" r="7"/>'+'</g>'+ln(120,120,120,176)};
  P.calf={t:'Elevación de gemelos',svg:'<g>'+AT('translate','0 0;0 -16;0 0','1.4s')+head(112,46)+ln(112,57,112,110)+ln(112,66,128,92)+ln(112,66,96,92)+ln(112,110,104,150)+ln(112,110,120,150)+'</g>'+'<g>'+AT('rotate','0 104 176;-26 104 176;0 104 176','1.4s')+ln(104,150,104,176)+ln(104,176,124,176,'em')+'</g>'+'<g>'+AT('rotate','0 120 176;-26 120 176;0 120 176','1.4s')+ln(120,150,120,176)+ln(120,176,138,176,'em')+'</g>'};
  P.chestpress={t:'Press de pecho',svg:ln(60,150,180,150,'eq')+ln(70,150,70,168,'eq')+ln(170,150,170,168,'eq')+head(78,138)+ln(90,140,150,140)+ln(150,140,168,158)+ln(150,140,168,168)+'<g>'+AT('translate','0 0;0 -30;0 0','1.9s')+ln(96,140,96,108,'em')+ln(120,140,120,108,'em')+ln(88,108,128,108,'eq')+'<circle class="wt" cx="86" cy="108" r="6"/><circle class="wt" cx="130" cy="108" r="6"/>'+'</g>'};
  P.pushup={t:'Flexión de brazos',svg:'<g>'+AT('translate','0 0;0 14;0 0','1.8s')+head(64,120)+ln(76,124,168,150)+ln(168,150,176,176)+ln(150,146,150,176,'em')+ln(90,127,90,176,'em')+'</g>'};
  P.pullup={t:'Tracción vertical',svg:ln(70,40,170,40,'eq')+'<g>'+AT('translate','0 0;0 -24;0 0','2.1s')+ln(104,40,104,64,'em')+ln(136,40,136,64,'em')+head(120,78)+ln(120,89,120,140)+ln(120,140,110,172)+ln(120,140,130,172)+'</g>'+updown()};
  P.row={t:'Remo (tracción horizontal)',svg:head(80,70)+ln(92,74,150,96)+ln(150,96,150,150)+ln(150,150,150,176)+ln(150,96,168,150)+'<g>'+AT('translate','0 0;22 -6;0 0','1.7s')+ln(120,88,120,128,'em')+ln(112,128,128,128,'eq')+'<circle class="wt" cx="110" cy="128" r="6"/><circle class="wt" cx="130" cy="128" r="6"/>'+'</g>'+'<g class="ar"><path d="M96 96 l10 -4 -2 8 z"/></g>'};
  P.ohp={t:'Press de hombros',svg:head(120,44)+ln(120,55,120,120)+ln(120,120,106,168)+ln(120,120,134,168)+'<g>'+AT('translate','0 0;0 -26;0 0','1.9s')+ln(96,66,96,96,'em')+ln(144,66,144,96,'em')+'<circle class="wt" cx="96" cy="62" r="7"/><circle class="wt" cx="144" cy="62" r="7"/>'+'</g>'+ln(120,64,96,96)+ln(120,64,144,96)};
  P.raise={t:'Elevaciones',svg:head(120,44)+ln(120,55,120,120)+ln(120,120,106,168)+ln(120,120,134,168)+'<g>'+AT('rotate','0 108 66;-72 108 66;0 108 66','2s')+ln(108,66,108,104,'em')+'<circle class="wt" cx="108" cy="106" r="6"/>'+'</g>'+'<g>'+AT('rotate','0 132 66;72 132 66;0 132 66','2s')+ln(132,66,132,104,'em')+'<circle class="wt" cx="132" cy="106" r="6"/>'+'</g>'+ln(120,64,108,66)+ln(120,64,132,66)};
  P.curl={t:'Curl de bíceps',svg:head(120,44)+ln(120,55,120,122)+ln(120,122,106,168)+ln(120,122,134,168)+ln(120,64,102,98)+ln(120,64,138,98)+'<g>'+AT('rotate','0 102 98;120 102 98;0 102 98','1.8s')+ln(102,98,102,128,'em')+'<circle class="wt" cx="102" cy="130" r="6"/>'+'</g>'+'<g>'+AT('rotate','0 138 98;-120 138 98;0 138 98','1.8s')+ln(138,98,138,128,'em')+'<circle class="wt" cx="138" cy="130" r="6"/>'+'</g>'};
  P.triceps={t:'Extensión de tríceps',svg:head(120,44)+ln(120,55,120,120)+ln(120,120,106,168)+ln(120,120,134,168)+ln(120,62,120,96)+'<g>'+AT('rotate','120 120 96;175 120 96;120 120 96','1.7s')+ln(120,96,120,128,'em')+'<circle class="wt" cx="120" cy="130" r="6"/>'+'</g>'};
  P.plank={t:'Plancha (isométrico)',svg:'<g>'+AT('translate','0 0;0 -2;0 0','0.5s')+head(58,118)+ln(70,122,168,150)+ln(168,150,180,176)+ln(88,126,88,176,'em')+ln(150,146,150,176)+'</g>'+'<text x="120" y="46" fill="#58cc02" font-size="13" font-weight="800" text-anchor="middle" font-family="sans-serif">MANTENÉ</text>'+'<line class="gd" x1="60" y1="126" x2="176" y2="150"/>'};
  P.core={t:'Trabajo de core',svg:ln(150,150,120,120)+ln(150,150,168,120)+ln(150,150,150,176)+'<g>'+AT('rotate','0 128 128;-40 128 128;0 128 128','1.9s')+ln(128,128,96,150,'em')+head(86,150)+'</g>'+'<g class="ar"><path d="M104 120 l-9 5 1 -9 z"/></g>'};
  P.cardio={t:'Cardio',svg:head(120,44)+ln(120,55,120,116)+'<g>'+AT('rotate','20 120 66;-20 120 66;20 120 66','0.7s')+ln(120,66,104,92,'em')+'</g>'+'<g>'+AT('rotate','-20 120 66;20 120 66;-20 120 66','0.7s')+ln(120,66,136,92,'em')+'</g>'+'<g>'+AT('rotate','22 120 116;-22 120 116;22 120 116','0.7s')+ln(120,116,116,150)+ln(116,150,110,176)+'</g>'+'<g>'+AT('rotate','-22 120 116;22 120 116;-22 120 116','0.7s')+ln(120,116,124,150)+ln(124,150,130,176)+'</g>'};
  P.generic={t:'Técnica',svg:head(120,46)+ln(120,57,120,120)+ln(120,80,100,104)+ln(120,80,140,104)+ln(120,120,106,168)+ln(120,120,134,168)};

  var MAP={'Sentadilla':'squat','Prensa de piernas':'squat','Zancadas':'squat','Peso muerto':'hinge','Peso muerto rumano':'hinge','Hip thrust':'hinge','Extensión de cuádriceps':'kneeiso','Curl femoral':'kneeiso','Elevación de gemelos':'calf','Press banca':'chestpress','Press inclinado con mancuernas':'chestpress','Aperturas':'chestpress','Máquina de pecho':'chestpress','Flexiones':'pushup','Fondos en paralelas':'pushup','Dominadas':'pullup','Jalón al pecho':'pullup','Remo con barra':'row','Remo con mancuerna':'row','Remo en polea baja':'row','Press militar':'ohp','Elevaciones laterales':'raise','Elevaciones frontales':'raise','Pájaros (deltoide posterior)':'raise','Face pull':'raise','Curl con barra':'curl','Curl con mancuernas':'curl','Curl martillo':'curl','Extensión de tríceps en polea':'triceps','Press francés':'triceps','Fondos de tríceps':'triceps','Plancha':'plank','Abdominales crunch':'core','Elevación de piernas colgado':'core','Russian twist':'core','Rueda abdominal':'core','Cinta (caminata inclinada)':'cardio','Bicicleta':'cardio','Elíptico':'cardio','Remo (máquina)':'cardio','Salto a la soga':'cardio'};

  var CUES={
    'Sentadilla':['Pies al ancho de hombros, punta levemente hacia afuera','Bajá llevando la cadera atrás, rodillas siguen la línea de los pies','Pecho arriba y espalda neutra; bajá hasta muslo paralelo','Empujá con el talón para subir'],
    'Prensa de piernas':['Espalda y cadera bien apoyadas en el respaldo','Bajá controlando hasta ~90° de rodilla','No trabes las rodillas al extender','Empujá con el medio del pie'],
    'Zancadas':['Paso largo; bajá la rodilla de atrás hacia el piso','Rodilla de adelante no pasa la punta del pie','Tronco erguido, mirada al frente','Empujá con el talón delantero'],
    'Peso muerto':['Barra pegada al cuerpo, pies bajo la cadera','Espalda neutra: llevá la cola atrás, pecho firme','Subí empujando el piso, no tirando con la espalda','Bloqueá la cadera arriba sin hiperextender'],
    'Peso muerto rumano':['Piernas casi rectas, apenas flexionadas','Llevá la cola atrás y sentí el estiramiento del femoral','Barra rozando el muslo, espalda neutra','Volvé apretando glúteos'],
    'Hip thrust':['Espalda alta apoyada en el banco','Empujá con talones y apretá glúteos arriba','Costillas abajo, no arquees la lumbar','Pausa de 1s en la contracción'],
    'Extensión de cuádriceps':['Espalda apoyada, rodilla alineada con el eje','Extendé sin trabar la rodilla de golpe','Pausá arriba apretando el cuádriceps','Bajá lento (2-3s)'],
    'Curl femoral':['Cadera fija, sin despegar la pelvis','Flexioná llevando el talón al glúteo','Controlá la bajada, no la sueltes','Rango completo sin rebote'],
    'Elevación de gemelos':['Subí lo más alto posible en punta de pie','Pausá arriba 1s','Bajá lento sintiendo el estiramiento','Rodillas estables'],
    'Press banca':['Escápulas juntas y apoyadas, pies firmes','Barra a la línea del pecho, codos ~45°','Bajá controlando y empujá en línea recta','No rebotes en el pecho'],
    'Press inclinado con mancuernas':['Banco a 30-45°','Bajá hasta la parte alta del pecho','Codos no totalmente abiertos','Subí sin chocar las mancuernas'],
    'Aperturas':['Codos apenas flexionados y fijos','Abrí en arco amplio sintiendo el pecho','No bajes más allá de la línea del hombro','Cerrá apretando el pecho'],
    'Máquina de pecho':['Ajustá el asiento: manijas a la altura del pecho','Empujá juntando sin trabar codos','Volvé controlando el estiramiento','Escápulas apoyadas'],
    'Flexiones':['Cuerpo en línea: cabeza, cadera y talones','Manos bajo los hombros, codos ~45°','Bajá el pecho casi al piso','Abdomen y glúteos firmes'],
    'Fondos en paralelas':['Hombros abajo, pecho ligeramente adelante','Bajá hasta ~90° de codo','No encojas los hombros','Subí sin trabar de golpe'],
    'Dominadas':['Agarre firme, pecho arriba','Tirá llevando los codos abajo y atrás','Subí hasta pasar el mentón la barra','Bajá controlando, sin soltarte'],
    'Jalón al pecho':['Pecho arriba, leve inclinación atrás','Llevá la barra al pecho con los codos','No uses impulso de la espalda baja','Controlá la subida'],
    'Remo con barra':['Bisagra de cadera, espalda neutra','Llevá la barra al abdomen con los codos','Apretá las escápulas al final','No te levantes con la lumbar'],
    'Remo con mancuerna':['Apoyá una mano y rodilla en el banco','Tirá el codo hacia la cadera','Espalda plana, sin rotar el torso','Controlá la bajada'],
    'Remo en polea baja':['Pecho arriba, tronco casi fijo','Llevá el mango al abdomen','Juntá las escápulas atrás','No te vayas para atrás con impulso'],
    'Press militar':['Core firme, glúteos apretados','Empujá arriba sin arquear la lumbar','Barra sobre la cabeza al final','Bajá al mentón controlando'],
    'Elevaciones laterales':['Codos apenas flexionados','Subí hasta la línea de los hombros','Guiá con los codos, no con las manos','Bajá lento, sin impulso'],
    'Elevaciones frontales':['Subí al frente hasta la altura del hombro','Sin balancear el tronco','Codos casi rectos','Bajá controlando'],
    'Pájaros (deltoide posterior)':['Torso inclinado hacia adelante','Abrí llevando los codos atrás y arriba','Sentí el deltoide posterior, no la espalda alta','Movimiento lento y controlado'],
    'Face pull':['Cuerda a la altura de la cara','Tirá abriendo hacia las orejas','Codos altos, apretá atrás','Controlá la vuelta'],
    'Curl con barra':['Codos pegados al cuerpo','Subí sin balancear el tronco','Apretá arriba el bíceps','Bajá lento hasta extender'],
    'Curl con mancuernas':['Codos fijos a los costados','Subí controlando, girá la muñeca','Apretá arriba','Bajá completo sin soltar'],
    'Curl martillo':['Agarre neutro (palmas enfrentadas)','Codos quietos al costado','Subí sin impulso','Trabaja braquial y antebrazo'],
    'Extensión de tríceps en polea':['Codos pegados al cuerpo, fijos','Extendé completo abajo','Volvé controlando hasta 90°','Tronco firme, no te encorves'],
    'Press francés':['Codos apuntando al techo, quietos','Bajá la barra hacia la frente','Extendé apretando el tríceps','Rango controlado, sin abrir codos'],
    'Fondos de tríceps':['Manos al ancho de hombros atrás','Bajá con codos hacia atrás (no afuera)','Subí extendiendo el tríceps','Hombros abajo'],
    'Plancha':['Antebrazos bajo los hombros','Cuerpo en línea recta, sin hundir la cadera','Apretá abdomen y glúteos','Respirá; mantené el tiempo objetivo'],
    'Abdominales crunch':['Zona lumbar apoyada','Enrollá subiendo los hombros, no el cuello','Exhalá al subir, apretá el abdomen','Bajá controlando'],
    'Elevación de piernas colgado':['Evitá balancearte','Subí las piernas llevando la pelvis','Controlá la bajada','Hombros activos en la barra'],
    'Russian twist':['Tronco inclinado atrás, pecho arriba','Girá de lado a lado desde el core','Controlá, no uses solo los brazos','Pies elevados = más difícil'],
    'Rueda abdominal':['Abdomen y glúteos firmes','Rodá adelante sin arquear la lumbar','Llegá hasta donde controles','Volvé tirando con el abdomen'],
    'Cinta (caminata inclinada)':['Postura erguida, mirada al frente','Sin agarrarte fuerte de las manijas','Inclinación para subir intensidad','Ritmo que te deje respirar'],
    'Bicicleta':['Ajustá el asiento: rodilla casi extendida abajo','Espalda relajada, sin encorvarte','Pedaleo redondo y constante','Resistencia según el objetivo'],
    'Elíptico':['Postura erguida, core activo','Empujá y tirá con brazos y piernas','Pisada completa, talón apoyado','Ritmo sostenido'],
    'Remo (máquina)':['Secuencia: piernas, tronco, brazos','Volvé: brazos, tronco, piernas','Espalda neutra, tirá con la espalda','No redondees la lumbar'],
    'Salto a la soga':['Saltos bajos, con la punta del pie','Muñecas giran la soga, no los brazos','Codos pegados al cuerpo','Ritmo constante y relajado']
  };

  function esc2(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  var VIDMAP={"Sentadilla":"sentadilla","Prensa de piernas":"prensa-de-piernas","Zancadas":"zancadas","Peso muerto":"peso-muerto","Peso muerto rumano":"peso-muerto-rumano","Hip thrust":"hip-thrust","Extensión de cuádriceps":"extension-de-cuadriceps","Curl femoral":"curl-femoral","Elevación de gemelos":"elevacion-de-gemelos","Press banca":"press-banca","Press inclinado con mancuernas":"press-inclinado-con-mancuernas","Aperturas":"aperturas","Máquina de pecho":"maquina-de-pecho","Flexiones":"flexiones","Fondos en paralelas":"fondos-en-paralelas","Dominadas":"dominadas","Jalón al pecho":"jalon-al-pecho","Remo con barra":"remo-con-barra","Remo con mancuerna":"remo-con-mancuerna","Remo en polea baja":"remo-en-polea-baja","Press militar":"press-militar","Elevaciones laterales":"elevaciones-laterales","Elevaciones frontales":"elevaciones-frontales","Pájaros (deltoide posterior)":"pajaros-deltoide-posterior","Face pull":"face-pull","Curl con barra":"curl-con-barra","Curl con mancuernas":"curl-con-mancuernas","Curl martillo":"curl-martillo","Extensión de tríceps en polea":"extension-de-triceps-en-polea","Press francés":"press-frances","Fondos de tríceps":"fondos-de-triceps","Plancha":"plancha","Abdominales crunch":"abdominales-crunch","Elevación de piernas colgado":"elevacion-de-piernas-colgado","Russian twist":"russian-twist","Rueda abdominal":"rueda-abdominal","Cinta (caminata inclinada)":"cinta-caminata-inclinada","Bicicleta":"bicicleta","Elíptico":"eliptico","Remo (máquina)":"remo-maquina","Salto a la soga":"salto-a-la-soga"};
  window.exerciseVideoUrl=function(name){return VIDMAP[name]?("videos/"+VIDMAP[name]+".mp4"):"";};
  window.exerciseAnim=function(name,videoUrl){
    var key=MAP[name]||'generic';
    var p=P[key]||P.generic;
    var cues=CUES[name]||['Controlá el movimiento en toda su amplitud','Respiración: exhalá en el esfuerzo','Priorizá la técnica antes que el peso'];
    var inner=videoUrl?('<video src="'+videoUrl+'" controls playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000"></video>'):svg(p.svg);
    var badge=videoUrl?'🎬 Técnica':'🎬 Demo de técnica';
    var box='<div class="vph" style="background:#37464f">'+inner+'<div style="position:absolute;left:8px;top:6px;background:rgba(0,0,0,.35);color:#eef4f2;font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px">'+badge+'</div></div>';
    var list=cues.map(function(c){return '<li style="margin:0 0 5px 0">'+esc2(c)+'</li>';}).join('');
    var guide='<div class="card" style="margin-top:8px;border-color:#dfeccb;background:#f6fbef"><div class="h" style="margin:0 0 6px;color:#4aa002">✅ Guía de técnica · '+esc2(p.t)+'</div><ul style="margin:0;padding-left:18px;font-size:13px;font-weight:600;color:#3c3c3c">'+list+'</ul><div class="cap" style="margin-top:8px">Apta para todos los niveles · figura guía. Cuando tu profe suba su propio video, aparece acá.</div></div>';
    return box+guide;
  };
})();
