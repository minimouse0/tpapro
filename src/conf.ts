import { JsonFile, Logger, YMLFile ,File} from "../lib";
import {data_path} from "../lib/plugin_info"

export const conf = new YMLFile(data_path+"/config.yml");
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
	currency: "money",
	price: 0,
	vip_free: true,
	vip_discount: 0.5,
	name: "金币"
}) ;
conf.init("vip", {
	role: "vip"
});
conf.init("lang", "zh_cn");
conf.init("default_preferences", {
	active: true,
	request_available: 120000,
	accept_mode: 2,
	random_active: false
});
conf.init("allow_spc_tp",false)

confMigration()

export function confMigration(){
	if(!File.ls(data_path).includes("config.json"))return;
	Logger.info("正在迁移旧版配置文件")
	const old = new JsonFile(data_path+"/config.json");
	conf.set("frequency_limit",old.get("frequency_limit"))
	const economyconf=old.get("economy")
	delete economyconf["type"]
	economyconf["currency"]=economyconf["object"]
	delete economyconf["object"]
	conf.set("economy",economyconf)
	const vip=old.get("vip")
	delete vip["type"]
	conf.set("vip",vip)
	const defaultp=old.get("default_preferences")
	defaultp["request_available"]=defaultp["requestavailable"]
	delete defaultp["requestavailable"]
	defaultp["accept_mode"]=defaultp["acceptmode"]
	delete defaultp["acceptmode"]
	conf.set("defeault_preferences",defaultp)
	conf.set("allow_spc_tp",old.get("allow_spc_tp"))
	conf.set("lang",old.get("lang"))
	File.rename(data_path+"/config.json",data_path+"/config.json.bak")
	Logger.info("配置文件迁移完成")
}


