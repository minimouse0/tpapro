import {Logger,InitEvent, Player,Currency, Command, PlayerJoinEvent, JsonFile} from "../lib/index.js";
import { maincmd,mgrcmd } from "./Command.js";
import {conf} from "./conf.js"
import { db,dbloaded,PlayerPreference } from "./data.js";
import { playerIsIgnored, playerUnableToTpa } from "./tp.js";
maincmd.name
mgrcmd.name
//注册指令
//Command.register(maincmdObj)
//Command.register(mgrcmdObj)
//问题
//1. 插件在新建文件时不能提前新建好文件夹
//2. 默认配置里的money如果服务器里没有对应计分板，会导致插件报错，然而新档都没有这个计分板


///////注册监听器//////
//let tpaAskEvent=new Listener("ontpaproTpaAsk");
//let tpaEvent=new Listener("ontpaproTpa")
//Listener.init(PLUGIN_NAME);


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
	if(!dbloaded){
		Logger.fatal("有玩家正在进入服务器！由于数据库未加载，现在不会初始化他的数据。请尽快结束维护并重载插件。")
		return;
	}
	if(!playerUnableToTpa(e.player))new PlayerPreference(e.player.uuid,db).init()
})
//成功传送的触发条件有3个，自动接受，指令接受（从缓存读取），弹窗接受（弹窗的暂存按钮也算指令接受）
//在传送前，只有检查是否频繁的函数通过了，才会传送
//传送后，向数组记录传送者被传送者和传送种类以及传送时间


