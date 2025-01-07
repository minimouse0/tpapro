import { Player } from "../lib";
import { db } from "./data";

enum TPATYPE{
    TPA,
    TPAHERE
}

interface tpaRequest{
    /**发起者 */
    origin:Player,
    /**接受者 */
    target:Player,
    /**通过这个判断发起和接受 */
    type:TPATYPE,
    /**请求被**缓存**的时间，用于检查请求是否过期，以1970年1月1日以来的毫秒数计 */
    time:Date
}

const cachedrequests:tpaRequest[] = [];
const requestshistory:tpaRequest[] = [];
/**
 * 只有从缓存中读取请求时才会调用这个函数，缓存中标明了是tpa还是tpahere，所以即使是tpahere，也会用这个函数传送
 * @param player tpa的请求者
 */
export function tpa(player:Player){
	let norequests=true;
    //遍历已有请求寻找属于该玩家的已缓存请求
	for(let i in cachedrequests){
        const cachedRequest=cachedrequests[i]
        //旧版为什么要检测这个？没写注释，我完全忘了
		if(!cachedRequest.origin.uuid){
			continue;
		}
        //
		if(cachedRequest.target.uuid==player.uuid &&
            //检测请求是否过期
            new Date().getTime()-cachedRequest.time.getTime()<=new PlayerPreference(cachedRequest.origin.uuid,db).data.get("uuid").requestavailable
        ){
			//这个缓存的请求是tpa还是tpahere
            switch(cachedRequest.type){
                case TPATYPE.TPA:fixTeleport(cachedRequest.origin,cachedRequest.target.location)
                case TPATYPE.TPAHERE:fixTeleport(cachedRequest.target,cachedRequest.origin.location)
            }
			if (toooften(cachedRequest.origin)) economy.reduce(cachedRequest.origin.uuid, conf.get("frequency_limit").limit_price);//频繁价格
			//requestshistory指令接受
            //在请求历史中压入刚刚执行的请求
			requestshistory.unshift(cachedRequest);
            //请求历史的时间表示请求被响应的时间，列表的第一个（索引0）是刚被压入，需要被写入时间的
			requestshistory[0].time = new Date()
            //按基础价格进行扣款
			economy.reduce(cachedRequest.origin.uuid, conf.get("economy").price);

			//记得写经济是否充足
			//如果玩家经济不充足会被直接拒绝
			//如果玩家经济充足才会进到这里然后被扣钱
            //从缓存的请求中删除当前请求，我知道为什么要用i了，因为我需要从数组中定位现在这个请求，然后好删除它
			cachedrequests.splice(Number(i),1);
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

function tpadeny(player){
    let i;
    let norequests=true;
    for(i=0;i<cachedrequests.length;i++){
        if(cachedRequest.origin.uuid==null){
            continue;
        }
        if(cachedRequest.target.uuid==player.uuid&&new Date().getTime()-cachedRequest.time<=individualpreferences.get("preferences")[getIFromPref(cachedRequest.origin.uuid)].requestavailable){
            cachedRequest.origin.tell(`${cachedRequest.target.name}拒绝了您的请求`)
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