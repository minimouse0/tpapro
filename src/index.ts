import {Logger,InitEvent, Player,Currency, Command, PlayerJoinEvent} from "../lib/index.js";
import {conf} from "./conf.js"
import { maincmdObj,mgrcmdObj } from "./Command.js";
import { db,PlayerPreference } from "./data.js";
//注册指令
Command.register(maincmdObj)
Command.register(mgrcmdObj)

InitEvent.on((e)=>{
    Logger.info("This Full Moon Platform plugin successfully loaded.");
    return true;
})


///////注册监听器//////
//let tpaAskEvent=new Listener("ontpaproTpaAsk");
//let tpaEvent=new Listener("ontpaproTpa")
//Listener.init(PLUGIN_NAME);

const economy = new Currency(conf.get("economy").object);

const playersNotIgnored=[];

function dbMigration(player:Player){
    Logger.info(`玩家${player.name}的数据未迁移！正在迁移该玩家的数据`);
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



//初始化玩家的偏好设置
PlayerJoinEvent.on(e=>{
	if(playerIsIgnored(e.player))return;
	if(getIFromPref(e.player.uuid)==null){//找不到玩家的信息
        //在根目录中找到了未迁移玩家的信息
		if(/*individualpreferences.get(e.player.uuid)!=null*/false)dbMigration(e.player)
        //都没找到，证明该玩家第一次进服
		else new PlayerPreference(e.player.uuid,db).init()
	}

})
//成功传送的触发条件有3个，自动接受，指令接受（从缓存读取），弹窗接受（弹窗的暂存按钮也算指令接受）
//在传送前，只有检查是否频繁的函数通过了，才会传送
//传送后，向数组记录传送者被传送者和传送种类以及传送时间






ll.export(toooften, "tpapro", "tpaFrequently");



function payForFrequency(player,type) {

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
