import { 
    JsonFile,
    Logger, 
    Player
} from "../lib";

let PrefIndexCache:any={}
//以下是早期的迁移配置文件逻辑，到时候会单独出一个插件
/**
 * 因为这个，需要安装一个外部的leveldb库
 */
export class LLSEKVDB{

}
export class LLSEJsonConfigFile{
    fileobj:JsonFile
    constructor(path:string){
        this.fileobj=new JsonFile(path)
    }
    get(key:string):any{
        return this.fileobj.get(key)
    }
    set(key:string,value:any){
        return this.fileobj.set(key,value)
    }
    reload(){
        this.fileobj.reload()
    }
}



export function oldConfMigration(individualpreferences:LLSEKVDB,conf:LLSEJsonConfigFile){

	const currentConfVersion = 2;
	const currentIndivPrefVersion=2;
	let indivPrefVersion = checkIndivPrefVersion();
	let confVersion = checkconfversion();
	if (confVersion < currentConfVersion) {
		Logger.info(`tpapro/config.json的协议过旧`);
		Logger.info(`当前文件协议：${confVersion}，当前插件所需协议：${currentConfVersion}`);
		Logger.info(`正在更新tpapro/config.json`);
		updateConfVersion(confVersion, currentConfVersion);
		conf.reload();
		Logger.info(`更新完成，当前协议：${checkconfversion()}`)
	}
	if (indivPrefVersion < currentIndivPrefVersion) {
		Logger.info(`tpapro/individualpreferences.json的协议过旧`);
		Logger.info(`当前文件协议：${indivPrefVersion}，当前插件所需协议：${currentIndivPrefVersion}`);
		Logger.info(`正在更新tpapro/individualpreferences.json`);
		updateIndivPrefVersion(indivPrefVersion, currentIndivPrefVersion);
		individualpreferences.reload();
		RefreshPrefIndexCache()
		Logger.info(`更新完成，当前协议：${checkIndivPrefVersion()}`)
	}
    
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
	
	function updateIndivPrefVersion(origin, target) {
		let current = origin;
		let write;
		while (current < target) {
			switch (current) {
				case 1: {
					let modifydata = individualpreferences.read();
					let modifyarray:any = [];
					let targetarray:any = []
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
}
export function getIFromPref(uuid){
	if(PrefIndexCache[uuid]!=undefined){
		return PrefIndexCache[uuid];
	}
	return null;
}
/**
 * @param RefreshPrefIndexCache playerContents.json在文件内容改变时，刷新PrefIndexCache
 */
export async function RefreshPrefIndexCache(){
	let prefarr=individualpreferences.get("preferences")
	for(let i in prefarr){
		PrefIndexCache[prefarr[i].uuid]=i
	}
}
export function getPlayerFromName(name) {
	for (let player of Player.getAllOnline()) {
		if (player.name == name) return player;
	}
	return null;
}
//ll.export(getPlayerFromName, "tpapro", "getPlayerFromName");





//ll.export(toooften, "tpapro", "tpaFrequently");



function payForFrequency(player,type) {

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
