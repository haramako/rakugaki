(function(){

   var canvas; // Canvas
   var ws; // WebSocket
   var tool = 'pen';
   var loadingPanel;
   var button; // 押されたボタン
   var messagePool = []; // 初期の画像が読み込まれるまでのメッセージをためる配列
   var chatPanel;
   var chatInput;
   var chatHistory;
   var chatFocus = false;

   // Firefox6のWebSocketに対応
   if( !window.WebSocket && window.MozWebSocket ) window.WebSocket = window.MozWebSocket;
	 
   setTimeout( function(){
                 $('document').ready( initialize );
               }, 500 );

   function initialize(){
     // キャンバスの初期化
     canvas = $('#main_canvas');
     canvas
       .mousedown( mousedown )
       .bind( 'selectstart', function(){ return false; } ); // 選択開始しないようにする

     // flash canvas pro 用の設定
     var canvas_emu =  $('object', canvas[0]);
     if( canvas_emu[0] ){
       canvas_emu.mousedown( mousedown );
     }

     // ローディング中の表示     
     loadingPanel = $('.loading');
     
     // WebSocketの初期化
     ws = new WebSocket('ws://'+document.location.hostname+':3002');
     ws.onopen = function(ev){
       console.log( 'opened' );
     };
     ws.onmessage = function(ev){
       var msg = JSON.parse( ev.data );
       if( msg instanceof Array ){
         // 配列の場合、複数のメッセージが連なってるよ
         for( var i=0; i<msg.length; i++ ) onmessage( msg[i] );
       }else{
         onmessage( msg );
       }
     };
     ws.onclose = function(ev){
       console.log( 'closed' );
     };

     // ボタンのイベントを設定する
     $('#pen').click( function(){ tool = 'pen'; } );
     $('#eraser').click( function(){ tool = 'eraser'; } );
     $('#hand').click( function(){ tool = 'hand'; } );
     $('#clear').click( function(){ save(); ws.send(JSON.stringify({type:'clear'})); } );
     $('#save').click( function(){ save(); } );
     $('#list').click( function(){ window.open('/pictures'); } );

     // チャット関係
     chatPanel = $('#chat');
     chatInput = $('#chat-input');
     chatHistory = $('#chat-history');
     chatInput.keydown( function(ev){
                          if( ev.keyCode == 13 ){
                            say( chatInput.val() );
                            chatInput.val('');
                            return false;
                          }
                          return true;
                        });
     chatInput.focus( function(){ chatFocus = true; chatHistory.stop(true,true).fadeIn(1); } )
       .blur( function(){ chatFocus = false; chatHistory.stop(true,true).fadeOut(1000); } );
   }

   var prevPos = null;

   function mousemove(ev){
     var pos = {x:ev.pageX - canvas.offset().left, y:ev.pageY - canvas.offset().top };
     var c = canvas[0].getContext('2d');
     switch( tool ){
     case 'pen':
       if( prevPos ){
         c.save();
         c.strokeStyle = '#000';
         c.lineWidth = 1;
         c.lineCap = 'round';
         
         c.beginPath();
         c.moveTo( prevPos.x, prevPos.y );
         c.lineTo( pos.x, pos.y );
         c.stroke();
         
         c.restore();

         ws.send( JSON.stringify( {type:'draw', from_x:prevPos.x, from_y:prevPos.y, to_x:pos.x, to_y:pos.y }) );
       }
       break;
       
     case 'eraser':
       if( prevPos ){
         c.save();
         c.strokeStyle = '#fff';
         c.lineWidth = 20;
         c.lineCap = 'round';
         
         c.beginPath();
         c.moveTo( prevPos.x, prevPos.y );
         c.lineTo( pos.x, pos.y );
         c.stroke();
         
         c.restore();

         ws.send( JSON.stringify( {type:'eraser', from_x:prevPos.x, from_y:prevPos.y, to_x:pos.x, to_y:pos.y }) );
       }
       break;

     case 'hand':
       canvas.css( { left: ev.pageX - prevPos.x, top: ev.pageY-prevPos.y });
       pos = prevPos; // 最初につかんだ位置をわすれないため
       break;
       
     default:
       console.warn( 'unknown tool', tool );
     }

     prevPos = pos;
     return true;
   }

   function mousedown(ev){
     if( ev.which != 1 ) return true;
     button = ev.which;
     prevPos = {x:ev.offsetX, y:ev.offsetY };
     $(document).mouseup( mouseup );
     $(document).mousemove( mousemove );
     return false;
   }

   function mouseup(ev){
     $(document).unbind( 'mouseup' );
     $(document).unbind( 'mousemove' );
     ev.cancelBubble = true;
     return false;
   }


   function onmessage(m){
     
     var c = canvas[0].getContext('2d');
	 // console.log( m );

     switch( m.type ){
     case 'draw':
       c.save();
       c.strokeStyle = '#000';
       c.lineWidth = 2;
       
       c.beginPath();
       c.moveTo( m.from_x, m.from_y );
       c.lineTo( m.to_x, m.to_y );
       c.stroke();
       
       c.restore();
       break;

     case 'eraser':
       c.save();
       c.strokeStyle = '#fff';
       c.lineWidth = 20;
       
       c.beginPath();
       c.moveTo( m.from_x, m.from_y );
       c.lineTo( m.to_x, m.to_y );
       c.stroke();
       
       c.restore();
       break;
       
     case 'clear':
       c.save();
       c.fillStyle = '#fff';
       c.fillRect( 0, 0, canvas.width(), canvas.height() );
       c.restore();
       break;

     case 'load':
       console.log( 'start loading' );
       messagePool = m.messagePool;
	   function loaded(){
         for( var i=0; i<messagePool.length; i++ ) onmessage( messagePool[i] );
         messagePool = null;
         loadingPanel.fadeOut(500, function(){
                                     loadingPanel.remove();
                                     loadingPanel = null;
                                   } );
	   }
       if( m.file ){
         var img = $('<img>').attr('src','/pictures/orig/'+m.file)
           .hide()
           .load(function(){
                   console.log( 'loaded' );
                   var c = canvas[0].getContext('2d');
                   c.drawImage( img[0], 0, 0 );
				   loaded();
               });
       }else{
         loaded();
       }
       break;
       
     case 'say':
       $('<div>').text( m.msg ).appendTo( chatHistory );
       while( chatHistory.children().size() > 10 ){
         $(chatHistory.children()[0]).remove();
       }
       if( chatFocus == false) chatHistory.stop(true,true).fadeIn(0).fadeOut(5000);
       break;
       
     default:
       console.warn( 'unknown message.', m );
     }
   }

   function save(){
     var data = canvas[0].toDataURL();
     ws.send(JSON.stringify({type:'save', data:data }) );
   }

   function say( message ){
     var now = new Date();
     ws.send(JSON.stringify({type:'say', msg: now.toLocaleTimeString() + ' ' + message }) );
   }

})();
