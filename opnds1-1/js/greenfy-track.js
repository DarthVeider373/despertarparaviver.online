/* Greenfy first-party. Instalar apenas em domínio autorizado e iniciar após consentimento. */
(function(){
  'use strict';
  var script=document.currentScript;if(!script)return;
  var endpoint=new URL('/api/track/click',script.src).href;
  var checkoutHosts=(script.getAttribute('data-checkout-hosts')||'pay.cakto.com.br,pay.hub.la,pay.hubla.la').split(',').map(function(s){return s.trim();});
  var siteId=script.getAttribute('data-site-id');
  var funnelId=script.getAttribute('data-funnel-id')||siteId;
  var started=false;
  function random(){return crypto.randomUUID().replace(/-/g,'');}
  function cookie(name){var m=document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
  function consent(){var c=window.greenfyConsent;return typeof c==='function'?c():c;}
  function measure(payload){
    if(!siteId)return;
    var begin=Date.now(),queue=[],seen={},sending=false,active=0,lastTick=begin,lastActivity=begin,lastSaved=0;
    var behaviorEndpoint=new URL('/api/track/behavior',script.src).href;
    function allowed(){var c=consent();return c&&c.analytics===true;}
    function elapsed(){return Math.min(86400000,Math.max(0,Date.now()-begin));}
    function emit(kind,key,seconds){
      if(!allowed()||elapsed()>=86400000)return;key=key||'';var id=kind+':'+key;if(seen[id])return;seen[id]=true;
      if(queue.length<100)queue.push({kind:kind,element_key:key,elapsed_ms:elapsed(),active_seconds:seconds});
    }
    function flush(attempt){
      if(!allowed()){queue=[];return;}if(sending||!queue.length)return;sending=true;
      var batch=queue.splice(0,20);
      fetch(behaviorEndpoint,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({visit_event_id:payload.event_id,tracking_site_id:siteId,vid:payload.vid,session_id:payload.session_id,consent_analytics:true,events:batch})}).then(function(r){if(!r.ok)throw new Error();sending=false;if(queue.length)flush(0);}).catch(function(){sending=false;if(allowed()&&(attempt||0)<2){queue=batch.concat(queue).slice(0,100);setTimeout(function(){flush((attempt||0)+1);},1500);}});
    }
    function key(el,attr,fallback){var value=el.getAttribute(attr)||fallback;return /^[a-zA-Z0-9_-]{1,80}$/.test(value)?value:null;}
    function visible(){return document.visibilityState!=='hidden'&&(!document.hasFocus||document.hasFocus());}
    var elements=[],observer=null;
    if(typeof IntersectionObserver!=='undefined')observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){
      elements.filter(function(x){return x.el===entry.target;}).forEach(function(item){
      var height=Math.min(entry.boundingClientRect.height,window.innerHeight||entry.boundingClientRect.height);
      item.visible=entry.isIntersecting&&height>0&&entry.intersectionRect.height/height>=0.5;
      if(!item.visible)item.since=null;
      });
    });},{threshold:[0,0.1,0.25,0.5,0.75,1]});
    function scan(){
      if(!allowed())return;
      [['data-greenfy-offer','offer_view','offer'],['data-greenfy-section','section_view',null]].forEach(function(def){
        document.querySelectorAll('['+def[0]+']').forEach(function(el){
          var name=key(el,def[0],def[2]);if(!name||elements.some(function(x){return x.el===el&&x.kind===def[1];}))return;
          // Só confirma suporte à exposição quando o navegador tem o observador.
          if(observer){emit(def[1]==='offer_view'?'config_offer':'config_section',def[1]==='offer_view'?'':name);var item={el:el,kind:def[1],key:name,visible:false,since:null};elements.push(item);observer.observe(el);}
        });
      });
      document.querySelectorAll('[data-greenfy-cta]').forEach(function(el){if(key(el,'data-greenfy-cta','cta'))emit('config_cta','');});
    }
    emit('tracker_ready','');scan();flush(0);
    if(typeof MutationObserver!=='undefined'){var scheduled=false;new MutationObserver(function(){if(!scheduled){scheduled=true;setTimeout(function(){scheduled=false;scan();},250);}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-greenfy-offer','data-greenfy-section','data-greenfy-cta']});}
    ['pointerdown','keydown','scroll','touchstart'].forEach(function(name){document.addEventListener(name,function(){if(allowed())lastActivity=Date.now();},{passive:true});});
    document.addEventListener('click',function(e){if(!allowed())return;var el=e.target&&e.target.closest?e.target.closest('[data-greenfy-cta]'):null;if(!el)return;var name=key(el,'data-greenfy-cta','cta');if(name){emit('config_cta','');emit('cta_click',name);flush(0);}},true);
    setInterval(function(){var now=Date.now(),delta=Math.min(1500,Math.max(0,now-lastTick));lastTick=now;
      if(!allowed()){queue=[];elements.forEach(function(x){x.since=null;});return;}
      if(visible()&&now-lastActivity<=60000){active=Math.min(7200000,active+delta);
        try{localStorage.setItem('greenfy_session:'+funnelId,JSON.stringify({id:payload.session_id,at:now}));}catch(_){}
      }
      elements.forEach(function(item){if(visible()&&item.visible&&document.documentElement.contains(item.el)){if(item.since===null)item.since=now;if(now-item.since>=1000)emit(item.kind,item.key);}else item.since=null;});
      var seconds=Math.floor(active/1000);if(seconds-lastSaved>=15){lastSaved=seconds;emit('active_time',String(seconds),seconds);}
      if(queue.length)flush(0);
    },1000);
    document.addEventListener('visibilitychange',function(){lastTick=Date.now();elements.forEach(function(x){x.since=null;});if(document.visibilityState==='hidden'){var seconds=Math.floor(active/1000);if(seconds)emit('active_time',String(seconds),seconds);flush(0);}});
    window.addEventListener('pagehide',function(){var seconds=Math.floor(active/1000);if(seconds)emit('active_time',String(seconds),seconds);flush(0);});
  }

  function start(){
    if(started)return;var c=consent();if(!c||c.analytics!==true)return;started=true;
    window.__greenfySites=window.__greenfySites||{};var installKey=siteId||endpoint;if(window.__greenfySites[installKey])return;window.__greenfySites[installKey]=true;
    try{
      var vid=cookie('greenfy_vid')||random();document.cookie='greenfy_vid='+encodeURIComponent(vid)+'; Max-Age=31536000; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
      var q=new URLSearchParams(location.search),now=Date.now(),saved=null;
      try{saved=JSON.parse(localStorage.getItem('greenfy_first')||'null');}catch(_){}
      if(!saved||now-saved.at>90*86400000){saved={at:now};['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ad_id','campaign_id','account_id'].forEach(function(k){if(q.get(k))saved[k]=q.get(k);});try{localStorage.setItem('greenfy_first',JSON.stringify(saved));}catch(_){}}
      var session=null,key='greenfy_session:'+funnelId;
      if(siteId){try{session=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
        if(!session||! /^[a-f0-9]{32}$/.test(session.id)||!Number.isFinite(session.at)||now-session.at>30*60000||session.at>now)session={id:random()};
        session.at=now;try{localStorage.setItem(key,JSON.stringify(session));}catch(_){}
      }
      var payload={vid:vid,event_id:random(),consent_analytics:true,consent_ads:c.ads===true,landing_url:location.origin+location.pathname,referrer:document.referrer};
      if(siteId){payload.tracking_site_id=siteId;payload.session_id=session.id;payload.tracker_version=2;}
      // Identifica a visita atual; mantém o primeiro toque somente como fallback.
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ad_id','campaign_id','account_id'].forEach(function(k){var v=q.get(k)||saved[k];if(v)payload[k]=v;});
      if(c.ads===true){['fbclid','gclid','gbraid','wbraid'].forEach(function(k){if(q.get(k))payload[k]=q.get(k);});payload.fbp=cookie('_fbp');payload.fbc=cookie('_fbc')||(payload.fbclid?'fb.1.'+now+'.'+payload.fbclid:null);}
      var measuring=false;
      function send(attempt){var current=consent();if(!current||current.analytics!==true)return;
        fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(function(r){if(!r.ok)throw new Error();if(!measuring){measuring=true;try{measure(payload);}catch(_){}}}).catch(function(){if(attempt<2)setTimeout(function(){send(attempt+1);},1000*(attempt+1));});
      }send(0);
      function decorate(link){var current=consent();if(!current||current.analytics!==true)return;try{var u=new URL(link.href,location.href);if(!checkoutHosts.includes(u.hostname))return;
        if(!u.searchParams.has('sck'))u.searchParams.set('sck',siteId?'gf1_'+payload.event_id:vid);
        // Não sobrescreve utm_term ou parâmetros de outra ferramenta.
        ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){if(!u.searchParams.has(k)&&payload[k])u.searchParams.set(k,payload[k]);});link.href=u.href;
      }catch(_){}}
      document.querySelectorAll('a[href]').forEach(decorate);
      document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(a)decorate(a);},true);
    }catch(_){/* Falha de mensuração nunca impede checkout ou navegação. */}
  }
  window.addEventListener('greenfy:consent',start);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
