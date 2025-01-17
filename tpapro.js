//插件注册
const PLUGIN_NAME="tpapro";
ll.registerPlugin(PLUGIN_NAME, "tpapro发行版-专注于解决社区常见tpa问题", [1, 3, 0]);
//已经是正式版了，不用写那个

//////listenAPI.js///////
let eventCatalog={};
let serverStarted=false;
let tryrereg=[]
/**
 * LLSE插件间监听器类
 */
class Listener{
    /**
     * 
     * @param {string} name 事件名
     */
    constructor(name){
        this.listenerList=[];
        eventCatalog[name]=this;
        //ll.export(this.regListenTest,namespace,name)
    }
    /**
     * 初始化当前插件的所有监听器
     * @param {string} pluginname 本插件的插件名
     */
    static init(pluginname){
        ll.export((namespace,name)=>{
            let obj=eventCatalog[name]
            let newlistener=ll.import(namespace,name)
            let i;//因为for i报错i is not defined
            for(i in obj.listenerList){
                if(obj.listenerList[i].namespace==namespace&&obj.listenerList[i].name==name){
                    obj.listenerList.splice(i,1);break;
                }
            }//相同名称，导出函数相同
            obj.listenerList.push({
                callback:newlistener,
                namespace:namespace,
                name:name
            });
        },pluginname,"EventListener")
    }/**
     * 监听事件
     * @param {string} listenedPluginName 要监听的插件名
     * @param {string} pluginName 当前插件的插件名
     * @param {string} eventname 要监听的事件名
     * @param {function} callback 回调函数，返回一个布尔可作为判断是否要拦截事件
     */
    static on(listenedPluginName,pluginName,eventname,callback){
        if(!serverStarted&&!ll.listPlugins().includes(listenedPluginName)){
            //logger.warn("监听器注册失败，被监听插件可能未加载完毕，服务器开启后将再次尝试注册")
            tryrereg.push({
                listenedPluginName:listenedPluginName,
                pluginName:pluginName,
                eventname:eventname,
                callback:callback
            })
            return;
        }
        ll.import(listenedPluginName,"EventListener")(pluginName,eventname);
        ll.export(callback,pluginName,eventname) 
    }/**
     * 执行监听的插件的回调函数
     * @param {any} arg 回调函数传入的参数，因作者技术有限目前最多支持10个，后面所有变量均可作为可选，如有需要可修改源码此处参数
     * @returns 
     */
    exec(args,arg2,arg3,arg4,arg5,arg6,arg7,arg8,arg9,arg10){
        //开始执行监听
        let returned=true;
        let i;
        for(i in this.listenerList){
            if(this.listenerList[i].callback!=undefined&&ll.hasExported(this.listenerList[i].namespace,this.listenerList[i].name)){
                if(this.listenerList[i].callback(args,arg2,arg3,arg4,arg5,arg6,arg7,arg8,arg9,arg10)==false){returned=false;}
            }        
        }
        return returned;
    }
}
//在被监听插件里面需要这个onServerStarted吗？我也不知道
mc.listen("onServerStarted",()=>{
    serverStarted=true;
    tryrereg.forEach((currentValue)=>{
        if(ll.listPlugins().includes(currentValue.listenedPluginName)){
            Listener.on(currentValue.listenedPluginName,currentValue.pluginName,currentValue.eventname,currentValue.callback)            
        }
        else{
            logger.error("监听器注册失败，被监听插件未加载")
        }         
    }) 
})
/////////////////////////

////////gmoney///////////
//这个类用于对接多种经济核心
/**
 * 使用方法  
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
/////////////////////////


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
if (indivPrefVersion < currentIndivPrefVersion) {
	log(`tpapro/individualpreferences.json的协议过旧`);
	log(`当前文件协议：${indivPrefVersion}，当前插件所需协议：${currentIndivPrefVersion}`);
	log(`正在更新tpapro/individualpreferences.json`);
	updateIndivPrefVersion(indivPrefVersion, currentIndivPrefVersion);
	individualpreferences.reload();
	RefreshPrefIndexCache()
	log(`更新完成，当前协议：${checkIndivPrefVersion()}`)
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

/**
 * 假设数据库根目录所有键值的格式相同
 * 此基础上将数据库中的信息定为一个类，并用类的方法和属性辅助操作每个键值
 * 数据库是一张多维的表格，在数据库中，以对象的形式，以网状的格式存储
 * 每个类都是一个维度
 * @param {KVDatabase} individualPreferences2
 */
let individualPreferences2=new KVDatabase("plugins\\tpapro\\individualPreferences")

class PlayerPreference{
	constructor(uuid,KVDBFile){
		this.uuid=uuid;
		this.KVDBFile=KVDBFile;
		this.init();
		this.data=this.KVDBFile.get(this.uuid)
	}
	init(){//初始化，数据更新也写在这
		if(this.KVDBFile.get(this.uuid)==null){
			this.KVDBFile.set(this.uuid,{})
		}
	}
	/**
	 * 
	 * @param {string} key 
	 * @param {any} data 
	 */
	set(key,data){
		let write=this.KVDBFile.get(this.uuid)
		write[key]=data
		this.KVDBFile.set(this.uuid,write)
	}
}
class PermissionList extends PlayerPreference{//用类继承来表示各个配置项的从属关系
	/**
	 * 
	 * @param {string} uuid 玩家uuid
	 * @param {KVDatabase} KVDBFile kvdb数据库类实例
	 */
	constructor(uuid,KVDBFile){
		super(uuid,KVDBFile);
		this.data=this.data.permissionList;
	}
	init(){//初始化，数据更新也写在这
		super.init()
		if(this.KVDBFile.get(this.uuid).permissionList==undefined){
			super.set("permissionList",PermissionList.newPermissionList())
		}
	}
	/**
	 * 
	 * @param {string} key 写入值的键名
	 * @param {any} data 写入的数据
	 */
	set(key,data){
		let write=this.data
		write[key]=data
		super.set("permissionList",write)		
	}
	isAllowed(uuid){
		switch(this.data.mode){
			case "blacklist":{
				return !this.data.blacklist.includes(uuid);
			}
			case "whitelist":{
				return this.data.whitelist.includes(uuid);
			}
		}
	}
	static newPermissionList(){
		return {
			mode:"blacklist",
			whitelist:[],
			blacklist:[]
		}	
	}
}

testKVDB();
function testKVDB(){
	let t="202304171030"
	let tpermissionlist = new PermissionList(t,individualPreferences2)
	tpermissionlist.set("mode","whitelist")
}

let PrefIndexCache={}
RefreshPrefIndexCache()
/** 
 * @param {Player} origin 发起者
 * @param {Player} target:接受者
 * @param {string} type:可选"tpa"和"tpahere"，通过这个判断发起和接受
 * @param {Int} time:请求被 缓存 的时间，用于检查请求是否过期，以1970年1月1日以来的毫秒数计
 * */
let cachedrequests = [];
/**
 * @param {Player} origin 发起者
 * @param {Player} target 接受者
 * @param {string} type 可选"tpa"和"tpahere"，通过这个判断发起和接受
 * @param {Int} time 执行传送的时间
 * */
let requestshistory = [];

///////注册监听器//////
let tpaAskEvent=new Listener("ontpaproTpaAsk");
let tpaEvent=new Listener("ontpaproTpa")
Listener.init(PLUGIN_NAME);

let economy = new gmoney(conf.get("economy").type, conf.get("economy").object);

let playersNotIgnored=[];

///////指令注册///////
let maincmd = mc.newCommand("tpa", "传送至其他玩家，或将其他玩家传送至您这里", PermType.Any);
maincmd.setEnum("accept", ["accept","a"]);
maincmd.setEnum("preferences", ["preferences","p"]);
maincmd.setEnum("here", ["here","h"]);
maincmd.setEnum("deny", ["deny","refuse","reject","decline","denial","d"]);
maincmd.setEnum("switch", ["switch", "s"]);
maincmd.setEnum("to", ["to"]);
maincmd.setEnum("requests", ["requests","r"]);
maincmd.mandatory("accept", ParamType.Enum, "accept");
maincmd.mandatory("preferences", ParamType.Enum, "preferences");
maincmd.mandatory("here", ParamType.Enum, "here");
maincmd.mandatory("deny", ParamType.Enum, "deny");
maincmd.mandatory("switch", ParamType.Enum, "switch");
maincmd.mandatory("to", ParamType.Enum, "to");
maincmd.mandatory("target", ParamType.Player)
maincmd.mandatory("requests", ParamType.Enum,"requests")
maincmd.overload([]);
maincmd.overload(["to","target"]);
maincmd.overload(["accept"]);
maincmd.overload(["preferences"]);
maincmd.overload(["here"]);
maincmd.overload(["here","to","target"]);
maincmd.overload(["deny"]);
maincmd.overload(["switch"]);
maincmd.overload(["requests"]);
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
	//tpa设置
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
		RefreshPrefIndexCache()
		if (write[getIFromPref(origin.player.uuid)].active) { origin.player.tell("您已经开启了tpa功能。输入/tpa preferences来调整偏好设置。"); }
		else { origin.player.tell("您已经关闭了tpa功能。输入/tpa switch来重新开启。"); }
	}
	else if (results.requests=="requests"||results.requests=="r"){sendRequestsForm(origin.player)}//选择一个仍然有效的请求来接受或拒绝
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
			RefreshPrefIndexCache()
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
	if(playerIsIgnored(player)){return;}
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
			RefreshPrefIndexCache()
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
			RefreshPrefIndexCache()	
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
		if(cachedrequests[i].origin.uuid==null){
			continue;
		}
		if(cachedrequests[i].target.uuid==player.uuid&&new Date().getTime()-cachedrequests[i].time<=individualpreferences.get("preferences")[getIFromPref(cachedrequests[i].origin.uuid)].requestavailable){
			//这个缓存的请求是tpa还是tpahere
			if(cachedrequests[i].type=="tpa"){
				fixTeleport(cachedrequests[i].origin,cachedrequests[i].target.pos)
			}else if(cachedrequests[i].type=="tpahere"){
				fixTeleport(cachedrequests[i].target,cachedrequests[i].origin.pos)
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

/**
 * 玩家选择请求目标的表单  
 * 需要注意目前共有两种方法能够让玩家选择目标  
 * 一种是这个表单  
 * 另一个是指令+目标选择器
 * @param {Player} player 请求此选择表单的玩家
 * @param {string} type tpa种类
 */
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
		if(playerIsIgnored(pl)){return;}//自动跳过假人
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

/** 
 * 向tpa目标发起询问  
 *   
 * tpa发起后，共有三种方式，一种是自动接受，直接在tpask里面，一种是弹窗提醒，在tpaskform里面，一种是指令接受，要从指令开始找
 * @param {Player} player 请求目标
 * @param {Player} origin 请求发起者
 * @param {string} type tpa种类，可选"tpa"或"tpahere"
 */
function tpask(player,origin,type){
	if(!tpaAskEvent.exec(player,origin,type)){return;}
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
				fixTeleport(origin,player.pos)
				//requestshistory自动接受的tpa
				if (toooften(origin)) {
					economy.reduce(origin, conf.get("frequency_limit").limit_price);//频繁价格
				}
				requestshistory.unshift({ origin: origin, target: player, type: type, time: new Date().getTime() });
				economy.reduce(origin, conf.get("economy").price);
			}
			if(type=="tpahere"){
				fixTeleport(player,origin.pos)
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
			RefreshPrefIndexCache()
			individualpreferences.reload();
			player.tell("已保存");
		}
	})
}

/** 
 * 弹窗提醒情况下向tpa目标发起询问的表单
 * @param {Player} player 请求目标
 * @param {Player} origin 请求发起者
 * @param {string} type tpa种类，可选"tpa"或"tpahere"
 */
function tpaskform(origin,target,type){
	let fm=mc.newSimpleForm();
	fm.addButton("接受")
	fm.addButton("拒绝")
	fm.addButton("暂存")
	if(type=="tpa"){
		fm.setContent(`${origin.name}希望传送到您这里。`)
		target.sendForm(fm,function(player,id){
			if(origin.uuid==null){
				target.tell("找不到发起请求的玩家，他可能已经下线了。")
				return;
			}
			if (id == 0) {
				fixTeleport(origin,target.pos)
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
			if(origin.uuid==null){
				target.tell("找不到发起请求的玩家，他可能已经下线了。")
				return;
			}
			switch (id) {
				case 0: {
					fixTeleport(target,origin.pos)
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
		if(cachedrequests[i].origin.uuid==null){
			continue;
		}
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
			//在这里加上黑白名单判断
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

function fixTeleport(player,pos){
	let target=pos;
	let threatBlock=mc.getBlock(pos.x-1,pos.y+1,pos.z-1,pos.dimid);
	if(!threatBlock.isAir){
		target=new FloatPos(pos.x,pos.y-1.5,pos.z,pos.dimid)
	}
	player.teleport(target);
}
/**
 * 
 * @param {Player} player 要判断是否频繁的玩家
 * @returns 是否频繁
 */
function toooften(player) {//判断是否频繁传送
	let times = 0,i=0;
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

/**
 * 向指定玩家发送选择tpa请求的表单
 * @param {Player} player 要发送表单的目标玩家
 */
function sendRequestsForm(player){
	/**
	 * @param {Array<Request>} availableRequests 对于这个玩家目前可用的请求列表
	 */
	let availableRequests=[]
	cachedrequests.forEach((currentValue)=>{//生成availableRequests
		if(currentValue.origin.uuid!=null){
			if(currentValue.target.uuid==player.uuid && new Date().getTime()-currentValue.time<=individualpreferences.get("preferences")[getIFromPref(currentValue.origin.uuid)].requestavailable){
				availableRequests.push(currentValue);
			}
		}
	})	
	let fm=mc.newSimpleForm();
	//生成并发送表单部分
	fm.setTitle("选择一个请求")
	fm.setContent("选择一个请求，并决定是否接受")
	availableRequests.forEach((currentValue)=>{
		fm.addButton("类型:"+currentValue.type+" 发起者:"+currentValue.origin.name+"\n"+(individualpreferences.get("preferences")[getIFromPref(currentValue.origin.uuid)].requestavailable-(new Date().getTime()-currentValue.time))/1000+"秒内有效");
		
	})
	player.sendForm(fm,(player,id)=>{
		if(id==null){return;}
		let chosenRequest=availableRequests[id]
		if(chosenRequest.origin.uuid==null){
			player.tell("没有找到请求发起者，该玩家可能已经下线。")
			return;
		}
		if(chosenRequest.target.uuid==player.uuid&&new Date().getTime()-chosenRequest.time<=individualpreferences.get("preferences")[getIFromPref(chosenRequest.origin.uuid)].requestavailable){
			let fm1=mc.newSimpleForm()
			fm1.setTitle(" ")
			fm1.setContent("对玩家"+chosenRequest.origin.name+"向您发起的"+chosenRequest.type+"请求")
			fm1.addButton("接受")
			fm1.addButton("拒绝")
			fm1.addButton("搁置")
			fm1.addButton("丢弃")
			player.sendForm(fm1,(player,id)=>{
				if(chosenRequest.origin.uuid==null){player.tell("没有找到请求发起者，该玩家可能已经下线。");return;}
				switch(id){
					case 0:{
						//这个缓存的请求是tpa还是tpahere
						if(chosenRequest.type=="tpa"){
							fixTeleport(chosenRequest.origin,chosenRequest.target.pos)
						}else if(chosenRequest.type=="tpahere"){
							fixTeleport(chosenRequest.target,chosenRequest.origin.pos)
						}
						if (toooften(chosenRequest.origin)) {
							economy.reduce(chosenRequest.origin, conf.get("frequency_limit").limit_price);//频繁价格
						}				
						economy.reduce(chosenRequest.origin, conf.get("economy").price);//基础价格
						requestDone(chosenRequest)		
						break;	
					}
					case 1:{
						chosenRequest.origin.tell(chosenRequest.target.name+"拒绝了您的"+chosenRequest.type+"请求")
						removeRequest(chosenRequest);
						break;
					}
					case 2:{
						break;
					}
					case 3:{
						removeRequest(chosenRequest)
					}
				}
			})

		}
		else{
			player.tell("该请求已过期。")
		}
	})
}

function payForFrequency(player,type) {

}
/**
 * 完成cachedrequests中的请求后的收尾动作
 * @param {Request} request 此次完成的请求
 */
async function requestDone(request){
	//requestshistory指令接受
	requestshistory.unshift(request);
	requestshistory[0].time = new Date().getTime();
	removeRequest(request)
}
async function removeRequest(request){
	cachedrequests.forEach((currentValue,i)=>{
		if(request.origin.uuid==currentValue.origin.uuid && request.target.uuid==currentValue.target.uuid && request.time==currentValue.time){
			cachedrequests.splice(i,1);
		}
	})
}
function getIFromPref(uuid){
	if(PrefIndexCache[uuid]!=undefined){
		return PrefIndexCache[uuid];
	}
	return null;
}
/**
 * @param {function} RefreshPrefIndexCache playerContents.json在文件内容改变时，刷新PrefIndexCache
 */
async function RefreshPrefIndexCache(){
	let prefarr=individualpreferences.get("preferences")
	for(let i in prefarr){
		PrefIndexCache[prefarr[i].uuid]=i
	}
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
		if (individualpreferences.get("preferences") == null) {
			break check;
		}
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
				write = { 
					type: write.type,
					object: write.object,
					price: write.price,
					vip_free: write.vip_free,
					vip_discount: write.vip_discount,
					name: "积分" 
				}
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
					targetarray[index] = { 
						name: individualpreferences.get(currentuuid).name, 
						active: individualpreferences.get(currentuuid).active, 
						requestavailable: individualpreferences.get(currentuuid).requestavailable, 
						acceptmode: individualpreferences.get(currentuuid).acceptmode , 
						uuid:currentuuid
					};
					individualpreferences.delete(currentValue.slice(1, currentValue.length - 4));
				})
				individualpreferences.init("preferences", targetarray);
				current++;
				break;
			}
			case 2:{
				write = conf.get("economy");
			}
		}
	}
}

/**
 * 检查玩家是否要被忽略
 * @param {Player} player 要检查的玩家
 * @returns 是否被忽略
 */
function playerIsIgnored(player){
	for(let i in playersNotIgnored){
		if(player==playersNotIgnored[i]){
			return false;
		}
	}
	if(player.isSimulatedPlayer()){
		return true;
	}
	return false;
}
function tpaHistory() {
	return requestshistory;
}
ll.export(tpaHistory, "tpapro", "tpaHistory");
function tpaRequests() {
	return cachedrequests;
}
ll.export(tpaRequests, "tpapro", "tpaRequests");
/**
 * 获取玩家偏好设置
 * @param {string} uuid 玩家的uuid，如果只有其他数据请用LLSE的内置接口转换
 * @returns 玩家设置的对象
 */
function getPlayerPref(uuid){return individualpreferences.get("preferences")[getIFromPref(uuid)];}
ll.export(getPlayerPref, "tpapro", "getPlayerPref");
/**
 * 写入玩家偏好设置  
 * 请注意，该接口是直接覆盖玩家的设置  
 * 所以在使用时，请先获取玩家的偏好设置，在其基础上修改后再写入
 * @param {string} uuid 玩家的uuid
 * @param {object} pref 玩家的偏好设置对象
 */
function writePlayerPref(uuid,pref){
	let write=individualpreferences.get("preferences")
	write[getIFromPref(uuid)]=pref;
	individualpreferences.set("preferences",write)
}
ll.exports(writePlayerPref,"tpapro","writePlayerPref")
/**
 * 通过UUID初始化玩家偏好设置
 * @param {string} uuid 玩家UUID
 * @param {string} callbackPlName 插件名
 * @param {string} callbackPlFnName 导出的回调函数在LLSE中的函数名
 */
async function initPlayerPref(uuid,callbackPlName,callbackPlFnName){
	let name=uuid2name(uuid);
	if(name==null){name="not specified";}
	if(getIFromPref(uuid)==null){//找不到玩家的信息
		if(individualpreferences.get(uuid)!=null){//在根目录中找到了未迁移玩家的信息
			log(`玩家${name}的数据未迁移！正在迁移该玩家的数据`);
			let write = individualpreferences.get("preferences");
			write.push({ 
				uuid: uuid,
				name: individualpreferences.get(uuid).name, 
				active: individualpreferences.get(uuid).active, 
				requestavailable: individualpreferences.get(uuid).requestavailable, 
				acceptmode: individualpreferences.get(uuid).acceptmode
			});
			individualpreferences.set("preferences",write);	
			RefreshPrefIndexCache()
			individualpreferences.delete(uuid);			
		}
		else{//都没找到，证明该玩家第一次进服
			let write = individualpreferences.get("preferences");
			write.push({ 
				uuid: uuid,
				name: name, 
				active: conf.get("default_preferences").active, 
				requestavailable: conf.get("default_preferences").requestavailable, 
				acceptmode: conf.get("default_preferences").acceptmode
			});
			individualpreferences.set("preferences",write);		
			RefreshPrefIndexCache()	
		}
	}
	if(callbackPlName!=undefined&&callbackPlFnName!=undefined){
		ll.imports(callbackPlName,callbackPlFnName)();
	}
}
ll.exports(initPlayerPref,"tpapro","initPlayerPref");
/**
 * 添加忽略条件的赦免玩家
 * @param {Player} player 要被赦免的玩家
 */
function addNotIgnoredPlayer(player){playersNotIgnored.concat([player]);}
ll.export(addNotIgnoredPlayer,"tpapro","addNotIgnoredPlayer");
function uuid2name(uuid){
	let allInfo=data.getAllPlayerInfo();
	for(let i in allInfo){
		if(allInfo[i].uuid==uuid){
			return allInfo[i].name;
		}
	}
	return null;
}

/*
 * 即将推出
不会加到tpapro中了，会作为扩展加入
可设置频率过快才消耗经济
对接一些权限组插件，vip用户可以不受频率限制或享受折扣
多语言
开放接口，可以通过这些接口获取插件内的数据
纯指令发送请求（/tpa 玩家名）
纯指令发送请求的玩家id输入不完整时，智能匹配名字最接近的玩家
tpa禁区
tpa禁区与领地插件对接
*/
