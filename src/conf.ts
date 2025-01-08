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




