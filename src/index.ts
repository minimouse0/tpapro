import {Logger,InitEvent, Player,Currency, Command, PlayerJoinEvent, JsonFile} from "../lib/index.js";
import {conf} from "./conf.js"
import { maincmdObj,mgrcmdObj } from "./Command.js";
import { db,PlayerPreference } from "./data.js";
import { playerIsIgnored } from "./tp.js";
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

function dbMigration(player:Player){
	const oldIndividualPreferences=new JsonFile("individualpreferences.json")
	const veryOldIndividualPreferences=oldIndividualPreferences.get("preferences")
    Logger.info(`玩家${player.name}的数据未迁移！正在迁移该玩家的数据`);
	//通过遍历原来的所有数据来一次性迁移
	//旧数据库有两个版本，都位于同一个文件中，一部分位于根目录直接用键值对存，另一部分位于preferences是一个数组，当前那个数组的读取慢的离谱，所以有了迁移玩家数据这个机制
	//此处不是write了，而是直接在新数据库中插入数据
    let write = oldIndividualPreferences.get("preferences");
    write.push({ 
        uuid: player.uuid,
        name: oldIndividualPreferences.get(player.uuid).name, 
        active: oldIndividualPreferences.get(player.uuid).active, 
        requestavailable: oldIndividualPreferences.get(player.uuid).requestavailable, 
        acceptmode: oldIndividualPreferences.get(player.uuid).acceptmode
    });
	//全部迁移完成后，不是删除键而是将文件夹重命名为.old结尾
    oldIndividualPreferences.set("preferences",write);	
    oldIndividualPreferences.delete(player.uuid);	
}



//初始化玩家的偏好设置
PlayerJoinEvent.on(e=>{
	/*
	//这些都没有必要了，因为这个版本的数据库是一次性地迁移完成，不需要在开服的时候监听
	if(playerIsIgnored(e.player))return;
	if(db.getRowFromPrimaryKey("individualpreferences",e.player.uuid)){//找不到玩家的信息
        //在根目录中找到了未迁移玩家的信息
		if(individualpreferences.get(e.player.uuid)!=null)dbMigration(e.player)
        //都没找到，证明该玩家第一次进服
		else 
	}
		*/
	new PlayerPreference(e.player.uuid,db).init()
})
//成功传送的触发条件有3个，自动接受，指令接受（从缓存读取），弹窗接受（弹窗的暂存按钮也算指令接受）
//在传送前，只有检查是否频繁的函数通过了，才会传送
//传送后，向数组记录传送者被传送者和传送种类以及传送时间


