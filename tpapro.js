ll.registerPlugin("tpapro", "tpapro发行版-专注于解决社区常见tpa问题", [1, 0, 1]);
log("作者：小鼠同学")
const individualpreferences = new JsonConfigFile("plugins\\tpapro\\individualpreferences.json");
const conf = new JsonConfigFile("plugins\\tpapro\\config.json");
//初始化config.json
conf.init("frequency_limit", {
	active: false,
	time_limit: 30000,
	requests_limit: 5,
	limit_price: 0,
	vip_limit_free: true,
	vip_limit_discount: 0.5,
	vip_limit: {
		active: false,
		time_limit: 30000,
		requests_limit: 10
	}
});
conf.init("economy", {
	type: "llmoney",
	object: "money",
	price: 0,
	vip_free: true,
	vip_discount: 0.5,
	name: "积分"
}) ;
conf.init("vip", {
	type: "permissionapi",
	role: "vip"
});
conf.init("lang", "zh_cn");
conf.init("default_preferences", {
	active: true,
	requestavailable: 120000,
	acceptmode: 2,
	random_active: false
});
//初始化individualpreferences.json
//上来先看版本，版本1连preferences都没有，所以如果版本判断是1，就直接升级，否则就初始化
//但是如果是空文件，也没有preferences
individualpreferences.init("preferences",[])
const currentConfVersion = 2;
const currentIndivPrefVersion=2;
let indivPrefVersion = checkIndivPrefVersion();
let confVersion = checkconfversion();
if (confVersion < currentConfVersion) {
	log(`tpapro/config.json的协议过旧`);
	log(`当前文件协议：${confVersion}，当前插件所需协议：${currentConfVersion}`);
	log(`正在更新tpapro/config.json`);
	updateConfVersion(confVersion, currentConfVersion);
	conf.reload();
	log(`更新完成，当前协议：${checkconfversion()}`)
}
//colorLog("dk_yellow","为什么更新后我的玩家偏好设置重置了？")
//colorLog("dk_yellow","0.4.0版本后，玩家数据结构更改，请依照 的方式手动更新");
if (indivPrefVersion < currentIndivPrefVersion) {
	log(`tpapro/individualpreferences.json的协议过旧`);
	log(`当前文件协议：${indivPrefVersion}，当前插件所需协议：${currentIndivPrefVersion}`);
	log(`正在更新tpapro/individualpreferences.json`);
	updateIndivPrefVersion(indivPrefVersion, currentIndivPrefVersion);
	individualpreferences.reload();
	log(`更新完成，当前协议：${checkIndivPrefVersion()}`)
}

//这个类用于对接多种经济核心
/*使用方法
 * 不要new money，因为llmoney就有个类叫money
 * 假如需要一个叫usd的gmoney对象
 * let usd = new gmoney(type,object)type填经济核心名，object如果核心是scoreboard就填计分项，如果是llmoney就不用填
 * set(player,value)player是玩家对象，value是要设置的钱数
 * */
class gmoney {
	constructor(type, object) {
		this.type = type;
		this.object = object;
	}
	set(player, value) {
		if (this.type == "llmoney") {
			money.set(player.xuid, value);
		} else if (this.type == "scoreboard") {
			let scoreboard = mc.getScoreObjective(this.object);
			scoreboard.setScore(player, value)
		}
	}
	reduce(player, value) {
		if (this.type == "llmoney") {
			money.reduce(player.xuid, value);
		} else if (this.type == "scoreboard") {
			let scoreboard = mc.getScoreObjective(this.object);
			scoreboard.reduceScore(player, value)
		}
	}
	get(player) {
		switch (this.type) {
			case "scoreboard": {
				return player.getScore(this.object);
				break;
			}
			case "llmoney": {
				return money.get(player.xuid);
				break;
			}
			case "TMEssential": {
				let func = ll.import("TMETApi", "getMoney");
				return func(player.realName);
			}
		}
	}
}
//导入其他插件
let pcsvipfunc;
mc.listen("onServerStarted", () => {
	switch (conf.get("vip").type) {
		case "pcsvip":{
			if (ll.listPlugins().includes("PCsvip")) {
				try {
					pcsvipfunc=ll.import("vipplayer");
				} catch {
					log("pcsvip已加载，但无法访问。")
				}
			} else {
				log("已选中pcsvip，但PCsvip.llse.js未加载。")
			}
			break;
		}
	}
})
class vips {
	constructor(type, role) {
		this.type = type;
		this.role = role;
	}
	isvip(player) {
		switch (this.type) {
			case "permissionapi": {
				return Permission.getRole(this.role).hasMember(player.xuid);
				break;
			}
			case "tag": {
				return player.hasTag(this.role);
				break;
			}
			case "pcsvip":{
				return pcsvipfunc(player.realName);
			}
		}
	}
}

let cachedrequests = [];
/*origin:发起者
 * target:接受者
 * type:可选"tpa"和"tpahere"，通过这个判断发起和接受
 * time:请求被 缓存 的时间，用于检查请求是否过期，以1970年1月1日以来的毫秒数计
 * */
let requestshistory = [];
/*origin:发起者
 * target:接受者
 * type:可选"tpa"和"tpahere"，通过这个判断发起和接受
 * time:执行传送的时间
 * */
let economy = new gmoney(conf.get("economy").type, conf.get("economy").object);
let maincmd = mc.newCommand("tpa", "传送至其他玩家，或将其他玩家传送至您这里", PermType.Any);
maincmd.setEnum("accept", ["accept","a"]);
maincmd.setEnum("preferences", ["preferences","p"]);
maincmd.setEnum("here", ["here","h"]);
maincmd.setEnum("deny", ["deny","refuse","reject","decline","denial","d"]);
maincmd.setEnum("switch", ["switch", "s"]);
maincmd.setEnum("to", ["to"]);
maincmd.mandatory("accept", ParamType.Enum, "accept");
maincmd.mandatory("preferences", ParamType.Enum, "preferences");
maincmd.mandatory("here", ParamType.Enum, "here");
maincmd.mandatory("deny", ParamType.Enum, "deny");
maincmd.mandatory("switch", ParamType.Enum, "switch");
maincmd.mandatory("to", ParamType.Enum, "to");
maincmd.mandatory("target", ParamType.Player)
maincmd.overload([]);
maincmd.overload(["to","target"]);
maincmd.overload(["accept"]);
maincmd.overload(["preferences"]);
maincmd.overload(["here"]);
maincmd.overload(["here","to","target"]);
maincmd.overload(["deny"]);
maincmd.overload(["switch"]);
maincmd.setCallback(function(cmd,origin,output,results){
	if (results.accept == "accept" || results.accept == "a") {//指令接受
		if (individualpreferences.get("preferences")[getIFromPref(origin.player.uuid)].active) {
			tpa(origin.player);
		}
		else {
			origin.player.tell("您未开启tpa。输入/tpa switch来开启。");
		}
	}
	else if (results.deny == "deny" || results.deny == "refuse" || results.deny == "reject" || results.deny == "decline" || results.deny == "denial" || results.deny == "d") {
		if (individualpreferences.get("preferences")[getIFromPref(origin.player.uuid)].active) {
			tpadeny(origin.player);
		}
		else {
			origin.player.tell("您未开启tpa。输入/tpa switch来开启。")
		}
	}
	else if (results.preferences == "preferences"||results.preferences == "p") {
		individualpreferencesform(origin.player);
	}
	//tpahere
	else if (results.here == "here" || results.here == "h") {
		whethertpa(origin.player,results.target,results.to=="to","tpahere");
	}
	//tpa开关
	else if (results.switch == "switch" || results.switch == "s") {
		let write = individualpreferences.get("preferences");
		write[getIFromPref(origin.player.uuid)].active = !write[getIFromPref(origin.player.uuid)].active;
		individualpreferences.set("preferences", write);
		if (write[getIFromPref(origin.player.uuid)].active) { origin.player.tell("您已经开启了tpa功能。输入/tpa preferences来调整偏好设置。"); }
		else { origin.player.tell("您已经关闭了tpa功能。输入/tpa switch来重新开启。"); }
	}
	//tpa
	else {
		whethertpa(origin.player,results.target,results.to=="to","tpa");
	}
})
maincmd.setup();
let mgrcmd = mc.newCommand("tpamgr", "管理您的tpa插件", PermType.GameMasters);
mgrcmd.setEnum("reload", ["reload"]);
mgrcmd.setEnum("log", ["log"]);
mgrcmd.setEnum("info", ["conf"]);
mgrcmd.mandatory("reload", ParamType.Enum, "reload");
mgrcmd.mandatory("log", ParamType.Enum, "log");
mgrcmd.mandatory("info", ParamType.Enum, "info");
mgrcmd.overload(["reload"]);
mgrcmd.overload(["log","info"]);
mgrcmd.setCallback((cmd, origin, output, results) => {
	if (results.reload == "reload") {
		if (conf.reload()) {
			if (origin.type == 0) {
				origin.player.tell("配置文件重载完成");
			} else if (origin.type == 7) {
				log("配置文件重载完成");
			}
		} else {
			if (origin.type == 0) {
				origin.player.tell("无法重载配置文件");
			} else if (origin.type == 7) {
				log("无法重载配置文件");
			}
		}
		if (individualpreferences.reload()) {
			if (origin.type == 0) {
				origin.player.tell("玩家偏好数据文件重载完成");
			} else if (origin.type == 7) {
				log("玩家偏好数据文件重载完成");
			}
		} else {
			if (origin.type == 0) {
				origin.player.tell("无法重载玩家偏好数据文件");
			} else if (origin.type == 7) {
				log("无法重载玩家偏好数据文件");
			}
		}
	}
	else if (results.log == "log") {//调试信息
		switch (results.info) {
			case "conf": {
				log(conf.read());
				origin.player.tell(`${conf.read()}`)
			}
		}
	}
})
mgrcmd.setup();

//初始化玩家的偏好设置
mc.listen("onJoin",(player)=>{
	if(getIFromPref(player.uuid)==null){//找不到玩家的信息
		if(individualpreferences.get(player.uuid)!=null){//在根目录中找到了未迁移玩家的信息
			log(`玩家${player.name}的数据未迁移！正在迁移该玩家的数据`);
			let write = individualpreferences.get("preferences");
			write.push({ 
				uuid: player.uuid,
				name: individualpreferences.get(player.uuid).name, 
				active: individualpreferences.get(player.uuid).active, 
				requestavailable: individualpreferences.get(player.uuid).requestavailable, 
				acceptmode: individualpreferences.get(player.uuid).acceptmode 
			});
			individualpreferences.set("preferences",write);	
			individualpreferences.delete(player.uuid);			
		}
		else{//都没找到，证明该玩家第一次进服
			let write = individualpreferences.get("preferences");
			write.push({ 
				uuid: player.uuid,
				name: player.name, 
				active: conf.get("default_preferences").active, 
				requestavailable: conf.get("default_preferences").requestavailable, 
				acceptmode: conf.get("default_preferences").acceptmode 
			});
			individualpreferences.set("preferences",write);			
		}
	}

})
//成功传送的触发条件有3个，自动接受，指令接受（从缓存读取），弹窗接受（弹窗的暂存按钮也算指令接受）
//在传送前，只有检查是否频繁的函数通过了，才会传送
//传送后，向数组记录传送者被传送者和传送种类以及传送时间

function tpa(player){//只有从缓存中读取请求时才会调用这个函数，缓存中标明了是tpa还是tpahere，所以即使是tpahere，也会用这个函数传送
	let i;
	let norequests=true;
	for(i=0;i<cachedrequests.length;i++){
		//log(cachedrequests[i].origin.name,",",cachedrequests[i].target.name)
		if(cachedrequests[i].target.uuid==player.uuid&&new Date().getTime()-cachedrequests[i].time<=individualpreferences.get("preferences")[getIFromPref(cachedrequests[i].origin.uuid)].requestavailable){
			//这个缓存的请求是tpa还是tpahere
			if(cachedrequests[i].type=="tpa"){
				cachedrequests[i].origin.teleport(cachedrequests[i].target.pos);
			}else if(cachedrequests[i].type=="tpahere"){
				cachedrequests[i].target.teleport(cachedrequests[i].origin.pos);
			}
			if (toooften(cachedrequests[i].origin)) {
				economy.reduce(cachedrequests[i].origin, conf.get("frequency_limit").limit_price);//频繁价格
			}
			//requestshistory指令接受
			requestshistory.unshift(cachedrequests[i]);
			requestshistory[0].time = new Date().getTime();
			economy.reduce(cachedrequests[i].origin, conf.get("economy").price);//基础价格

			//记得写经济是否充足
			//如果玩家经济不充足会被直接拒绝
			//如果玩家经济充足才会进到这里然后被扣钱
			cachedrequests.splice(i,1);
			norequests = false;
			break;
		}
	}
	if(norequests==true){player.tell(`最近没有收到任何tpa请求。`);}
}
function tpaform(player,type){
	let fm = mc.newSimpleForm()
	if (type == "tpa") {
		fm.setTitle("选择要传送到的玩家");
	}
	else if (type == "tpahere") {
		fm.setTitle("选择要传送过来的玩家");
	}
	let onlineplayers = []
	mc.getOnlinePlayers().forEach(pl => {
		onlineplayers.push(pl)
	})
	onlineplayers.forEach(function (item, index, arr) {
		if (item.uuid == player.uuid) {
		arr.splice(index, 1);
		}
	});	
	let i;
	for(i=0;i<onlineplayers.length;i++){
		fm.addButton(onlineplayers[i].name)
	}
	if(onlineplayers.length==0){player.tell("现在只有您自己在线。");}
	else{
		player.sendForm(fm,function(player,id){
			if(id!=null){
				if(individualpreferences.get("preferences")[getIFromPref(onlineplayers[id].uuid)].active){
					tpask(onlineplayers[id],player,type);//正式的发送tpa
				}
				else{
					player.tell(`${onlineplayers[id].name}未开启tpa。`)
				}
			}
		})
	}
}

function tpask(player,origin,type){
	switch(individualpreferences.get("preferences")[getIFromPref(player.uuid)].acceptmode){
		case 1:{//弹窗提醒
			tpaskform(origin, player, type);
			break;
		}
		case 2:{//指令接受
			if(type=="tpa"){
				player.tell(`${origin.name}希望传送到您这里。`);
				player.tell(`输入/tpa accept接受，输入/tpa deny拒绝。`);
				player.tell(`输入/tpa preferences来管理此通知。`)
				origin.tell(`由于${player.name}未设置弹窗提醒，对方输入指令同意前，您的请求将有效${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}秒。你可通过/tpa preferences调整有效时间。`)
				cachedrequests.unshift({origin:origin,target:player,type:type,time:new Date().getTime()})
			}
			if(type=="tpahere"){
				player.tell(`${origin.name}希望将您传送至他那里。`);
				player.tell(`输入/tpa accept接受，输入/tpa deny拒绝。`);
				player.tell(`输入/tpa preferences来管理此通知。`)
				origin.tell(`由于${player.name}未设置弹窗提醒，对方输入指令同意前，您的请求将有效${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}秒。你可通过/tpa preferences调整有效时间。`)
				cachedrequests.unshift({origin:origin,target:player,type:type,time:new Date().getTime()})
			}
			break;
		}
		case 0:{//自动接受
			if(type=="tpa"){
				origin.teleport(player.pos)
				//requestshistory自动接受的tpa
				if (toooften(origin)) {
					economy.reduce(origin, conf.get("frequency_limit").limit_price);//频繁价格
				}
				requestshistory.unshift({ origin: origin, target: player, type: type, time: new Date().getTime() });
				economy.reduce(origin, conf.get("economy").price);
			}
			if(type=="tpahere"){
				player.teleport(origin.pos)
				if (toooften(origin)) {
					economy.reduce(origin, conf.get("frequency_limit").limit_price);//频繁价格
				}
				//requestshistory自动接受的tpahere
				requestshistory.unshift({ origin: origin, target: player, type: type, time: new Date().getTime() });
				economy.reduce(origin, conf.get("economy").price);
			}
			break;
		}
	}
}
function individualpreferencesform(player){
	let fm=mc.newCustomForm();
	let preferences;
	fm.setTitle(`tpa设置`);
	let mode = ["自动接受","弹窗提醒","在聊天中显示"]
	fm.addLabel("如果关闭此开关，您将立即拒绝任何tpa请求，且/tpa指令除/tpa preferences外均禁用。您可通过输入/tpa preferences再次启用tpa。")
	fm.addSwitch("tpa开关",individualpreferences.get("preferences")[getIFromPref(player.uuid)].active);
	fm.addDropdown("接收到tpa请求时",mode,individualpreferences.get("preferences")[getIFromPref(player.uuid)].acceptmode)
	fm.addInput("tpa请求有效时间/秒"," ",(individualpreferences.get("preferences")[getIFromPref(player.uuid)].requestavailable/1000).toString())//
	player.sendForm(fm,function (player,data){
		if(data!=null){
			let write = individualpreferences.get("preferences");
			preferences=write[getIFromPref(player.uuid)];
			//开始对特定玩家的数据执行更改
			preferences.active=data[1];
			preferences.acceptmode=data[2];
			let requestavailableinput=120;
			if(Number.isSafeInteger(Number(data[3]))){
				if(data[3]>2147438647){
					player.tell(`tpa请求有效时间设置过大，该时间不得超过2147438647秒。已将您的tpa请求有效时间设置为2147438647秒。`)
					requestavailableinput=2147438647;
				}
				else if(data[3]==0){
					player.tell(`tpa请求有效时间不得设置为0秒，因为这会导致您的请求立即失效。已将您的tpa请求有效时间设置为5秒。`)
					requestavailableinput=5;
				}
				else if(data[3]%1!=0){
					player.tell(`tpa请求有效时间不能是小数。已将您的tpa请求有效时间设置为${data[3]-data[3]%1}。`)
					requestavailableinput=data[3]-data[3]%1;	
					
				}
				else if(data[3]<0){
					player.tell(`tpa请求有效时间不能是负数。`)
					if(data[3]<-2147438647){
						requestavailableinput=2147438647;
					}
					else if(data[3]%1!=0){
						requestavailableinput=data[3]+data[3]%1;
						requestavailableinput*=-1;
					}
					else{
						requestavailableinput=data[3]*-1;
					}
				}
				else{
					requestavailableinput=data[3];
				}
				preferences.requestavailable=requestavailableinput*1000;
			}
			else{
				player.tell(`您输入的tpa请求有效时间不完全是数字。已将您的tpa请求有效时间设置为${conf.get("default_preferences").requestavailable/1000}秒。`)
				preferences.requestavailable=conf.get("default_preferences").requestavailable
				
			}
			//更改特定玩家的数据结束，开始写入
			write[getIFromPref(player.uuid)]=preferences;
			individualpreferences.set("preferences",write);
			individualpreferences.reload();
			player.tell("已保存");
		}
	})
}
function tpaskform(origin,target,type){
	let fm=mc.newSimpleForm();
	fm.addButton("接受")
	fm.addButton("拒绝")
	fm.addButton("暂存")
	if(type=="tpa"){
		fm.setContent(`${origin.name}希望传送到您这里。`)
		target.sendForm(fm,function(player,id){
			if (id == 0) {
				origin.teleport(target.pos);
				//弹窗接受的tpa
				if (toooften(origin)) {
					economy.reduce(origin, conf.get("frequency_limit").limit_price);//频繁价格
				}
				requestshistory.unshift({ origin: origin, target: target, type: type, time: new Date().getTime() });
				economy.reduce(origin, conf.get("economy").price);
			}
			else if(id==1){origin.tell(`${target.name}拒绝了您的请求`)}
			else if(id==2){
				cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()})
				target.tell(`您已成功缓存了此请求。之后的${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内，输入/tpa accept来接受此请求，输入/tpa deny来拒绝此请求`)
			}
			else{
				origin.tell(`${target.name}设置了弹窗提醒，但弹窗未成功发送。这可能是因为${target.name}关闭了弹窗/或打开了物品栏/其他功能窗口/处于暂停界面/网络卡顿或开启了分屏/切换至其他窗口。您的请求已暂存，并在${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内有效。您可以提醒${target.name}输入/tpa accept接受，或重新发送请求。`);
				cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()})
			}			
		})		
	}
	if(type=="tpahere"){
		fm.setContent(`${origin.name}希望将您传送至他那里。`)
		target.sendForm(fm,function(player,id){
			switch (id) {
				case 0: {
					target.teleport(origin.pos);
					//弹窗接受的tpahere
					if (toooften(origin)) {
						economy.reduce(origin, conf.get("frequency_limit").limit_price);//频繁价格
					}
					requestshistory.unshift({ origin: origin, target: target, type: type, time: new Date().getTime() });
					economy.reduce(origin, conf.get("economy").price);
					break;
				}
				case 1:origin.tell(`${target.name}拒绝了您的请求`);break;
				case 2:{
					cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()});
					target.tell(`您已成功缓存了此请求。之后的${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内，输入/tpa accept来接受此请求，输入/tpa deny来拒绝此请求`)
					break;
				}
				default:{
					origin.tell(`${target.name}设置了弹窗提醒，但弹窗未成功发送。这可能是因为${target.name}关闭了弹窗/或打开了物品栏/其他功能窗口/处于暂停界面/网络卡顿或开启了分屏/切换至其他窗口。您的请求已暂存，并在${individualpreferences.get("preferences")[getIFromPref(origin.uuid)].requestavailable/1000}内有效。您可以提醒${target.name}输入/tpa accept接受，或重新发送请求。`);
					cachedrequests.unshift({origin:origin,target:target,type:type,time:new Date().getTime()})
				}
			}
		})
	}
}
function tpadeny(player){
	let i;
	let norequests=true;
	for(i=0;i<cachedrequests.length;i++){
		//log(cachedrequests[i].origin.name,",",cachedrequests[i].target.name)
		if(cachedrequests[i].target.uuid==player.uuid&&new Date().getTime()-cachedrequests[i].time<=individualpreferences.get("preferences")[getIFromPref(cachedrequests[i].origin.uuid)].requestavailable){
			cachedrequests[i].origin.tell(`${cachedrequests[i].target.name}拒绝了您的请求`)
			cachedrequests.splice(i,1);
			norequests=false;
			break;
		}
	}
	if(norequests==true){player.tell(`最近没有任何可以拒绝的tpa请求。`);}
}
function whethertpato(origin,targetarr,to,type){
	//执行tpa或tpaheres
	if (to) {
		if (targetarr[0] == null) {
			origin.tell("没有匹配的对象");
		}
		else {
			tpask(targetarr[0], origin,type);//玩家已经在指令中给出了tpa的对象，直接发送请求
		}
	}
	else {
		tpaform(origin,type);//让玩家选择tpa的对象。最终目标也是tpask()
	}
}
function whethertpa(origin,targetarr,to,type){
	if (individualpreferences.get("preferences")[getIFromPref(origin.uuid)].active) {//tpa
		limits: {
			//vip专属逻辑、tpa禁区可以直接写在前面这里
			//目前vip需要折扣、免费、不受频率限制，频繁后不加价或加价部分折扣
			//vip的扣费还是需要写在后面，这里只写检查余额
			if (conf.get("frequency_limit").active && toooften(origin) && conf.get("frequency_limit").limit_price > 0) {//频繁且付费
				//频繁后可以付费
				//特殊位置，单独写一份
				origin.sendModalForm("发送tpa请求过于频繁", `发送tpa请求过于频繁！暂时您需要花费${conf.get("frequency_limit").limit_price + conf.get("economy").price}${conf.get("economy").name}才能继续传送。`, "继续", "取消", function (player, result) {
					if (result) {
						if (economy.get(player) < conf.get("economy").price + conf.get("frequency_limit").limit_price) {
							player.tell("您的余额不足");
						} else {
							//执行tpa
							whethertpato(player,targetarr,to,type);
						}
					}
				});
				break limits;
			}
			else if (conf.get("frequency_limit").active && toooften(origin) && conf.get("frequency_limit").limit_price <= 0) {
				origin.tell("发送tpa请求过于频繁，请稍后再试");
				break limits;
			}
			if (economy.get(origin) < conf.get("economy").price && conf.get("economy").price > 0) {
				origin.tell(`您的余额不足，本服务器中tpa传送需花费${conf.get("economy").price}${conf.get("economy").name}`);
				break limits;
			}
			//执行tpa
			whethertpato(origin,targetarr,to,type);
		}
	}
	else{
		origin.tell("您未开启tpa。输入/tpa switch来开启。")
	}
}
function toooften(player) {
	let times = 0;
	for (i = 0; i < requestshistory.length; i++) {
		if (player.uuid == requestshistory[i].origin.uuid) {
			times++;
		}
		if (times >= conf.get("frequency_limit").requests_limit && new Date().getTime() - requestshistory[i].time<= conf.get("frequency_limit").time_limit) {
			return true;
		}
	}
	return false;
}

ll.export(toooften, "tpapro", "tpaFrequently");
function payForFrequency(player,type) {

}
function getIFromPref(uuid){
	let prefarr = individualpreferences.get("preferences");
	let i=0;
	for(i=0;i<prefarr.length;i++){
		if(prefarr[i].uuid==uuid){
			return i;
		}
	}
	return null;
}
function getPlayerFromName(name) {
	let i=1;
	for (i = 0; i < mc.getOnlinePlayers().length; i++) {
		if (mc.getOnlinePlayers()[i].realName == name) {
			return mc.getOnlinePlayers()[i];
		}
	}
	return null;
}
ll.export(getPlayerFromName, "tpapro", "getPlayerFromName");
function checkconfversion() {
	let version = 1;
	let trial;
	check: {
		if (conf.get("economy").name == null) {
			version = 1;
			break check;
		}
		version = currentConfVersion;
	}
	return version;
}	
function checkIndivPrefVersion() {
	let version = 1;
	let trial;
	check: {
		/*if (individualpreferences.get("preferences") == null) {
			version = 1;
			break check;
		}*/
		//如果要对preferences检测，需注意preferences是一个一个数组且可能为空
		version = currentIndivPrefVersion;
	}
	return version;
}	
function updateConfVersion(origin, target) {
	let current = origin;
	let write;
	while (current < target) {
		switch (current) {
			case 1: {
				write = conf.get("economy");
				write = { type: write.type, object: write.object, price: write.price, vip_free: write.vip_free, vip_discount: write.vip_discount, name: "积分" }
				conf.set("economy", write)
				current++;
				break;
			}
		}
	}
}
function updateIndivPrefVersion(origin, target) {
	let current = origin;
	let write;
	while (current < target) {
		switch (current) {
			case 1: {
				let modifydata = individualpreferences.read();
				let modifyarray = [];
				let targetarray = []
				let currentuuid;
				modifyarray = modifydata.match(/"....................................": {/g);
				modifyarray.forEach((currentValue, index) => {
					currentuuid = currentValue.slice(1, currentValue.length - 4);
					modifyarray[index]=currentValue.slice(1, currentValue.length - 4);
					targetarray.push(individualpreferences.get(currentValue.slice(1, currentValue.length - 4)));
					targetarray[index] = { name: individualpreferences.get(currentuuid).name, active: individualpreferences.get(currentuuid).active, requestavailable: individualpreferences.get(currentuuid).requestavailable, acceptmode: individualpreferences.get(currentuuid).acceptmode , uuid:currentuuid};
					individualpreferences.delete(currentValue.slice(1, currentValue.length - 4));
				})
				individualpreferences.init("preferences", targetarray);
				current++;
				break;
			}
		}
	}
}
function tpaHistory() {
	return requestshistory;
}
ll.export(tpaHistory, "tpapro", "tpaHistory");
function tpaRequests() {
	return cachedrequests;
}
ll.export(tpaHistory, "tpapro", "tpaRequests");

/*
 * 即将推出
可设置频率过快才消耗经济
对接一些权限组插件，vip用户可以不受频率限制或享受折扣
多语言
开放接口，可以通过这些接口获取插件内的数据
纯指令发送请求（/tpa 玩家名）
纯指令发送请求的玩家id输入不完整时，智能匹配名字最接近的玩家
tpa禁区
tpa禁区与领地插件对接
*/
