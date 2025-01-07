import { JsonFile, Logger, YMLFile } from "../lib";

export const conf = new YMLFile("plugins\\tpapro\\config.yml");
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