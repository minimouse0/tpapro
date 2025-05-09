import { Currency, JsonFile, Logger, Player, SQLDataType, SQLDataTypeEnum, SQLite3,File, SQLite3Column } from "../lib";
import { data_path } from "../lib/plugin_info.js"
import { conf } from "./conf.js";
//考虑到数据库加载失败一般会抛出异常，所以此处直接假设了dbloaded被执行的情况下数据库必然是加载成功的
export let db:SQLite3
export let dbloaded=false

export const tableName="individual_preferences"

export function unloaddb(){
	if(!dbloaded)return false
	const result=db.close()
	if(result)dbloaded=false
	return result
}

export function loaddb(){
	if(dbloaded)return false;
	const newColumnsFrom130:SQLite3Column[]=[
		{
			name:"xuid",
			data_type:new SQLDataType(SQLDataTypeEnum.TEXT),
		},
		{
			name:"name",
			data_type:new SQLDataType(SQLDataTypeEnum.TEXT),
		}
	]
	db=new SQLite3(data_path+"/data.db")
	//创建玩家个人设置表
	db.initTable(tableName,
		{
			name:"uuid",
			data_type:new SQLDataType(SQLDataTypeEnum.TEXT),
			constraint:{
				primary_key:true
			}
		},
		...newColumnsFrom130,
		{
			name:"permission_list",
			data_type:new SQLDataType(SQLDataTypeEnum.TEXT)
		},
		{
			name:"active",
			data_type:new SQLDataType(SQLDataTypeEnum.BOOLEAN)
		},
		{
			name:"accept_mode",
			data_type:new SQLDataType(SQLDataTypeEnum.INTEGER)
		},
		{
			name:"request_available",
			data_type:new SQLDataType(SQLDataTypeEnum.INTEGER)
		}
	)
	//创建从1.3.0以来新增的列
	for(let column of newColumnsFrom130)db.newColumn(tableName,column)
	dbloaded=true
	return true
}


function printDB(){
	Logger.info(db.queryAllSync("SELECT * FROM individual_preferences"))
}

export class PlayerPreference{
    uuid:string
    db:SQLite3
    data:Map<string,any>
	constructor(uuid:string,db:SQLite3){
		this.uuid=uuid;
		this.db=db;
		this.reload()
	}
	init(){//初始化，数据更新也写在这
		const playerObj=Player.getOnlinePlayer(this.uuid)
		if([...this.db.getRowFromPrimaryKey(tableName,this.uuid).keys()].length==0){
			this.db.setRowFromPrimaryKey(tableName,this.uuid,
			{
				columnName:"xuid",
				value:playerObj?.xuid
			},
			{
				columnName:"name",
				value:playerObj?.name
			},
			{
				columnName:"permission_list",
				value:"{}"
			},
			{
				columnName:"active",
				value:true
			},
			{
				columnName:"accept_mode",
				value:2
			},
			{
				columnName:"request_available",
				value:120000
			})
		}
		//更新该玩家的xuid和name数据
		const preference=new PlayerPreference(this.uuid,db)
		if(playerObj!=undefined)if(playerObj.isOnline())preference.set({xuid:playerObj.xuid,name:playerObj.name})
	}
	set(data:{
		xuid?:string,
		name?:string,
		active?:boolean,
		accept_mode?:number,
		request_available?:number
		permission_list?:any
	}){
		const OverwrittingData=this.db.getRowFromPrimaryKey(tableName,this.uuid)
		//玩家信息
		OverwrittingData.set("name",data.name!=undefined?data.name:OverwrittingData.get("name"))
		OverwrittingData.set("xuid",data.xuid!=undefined?data.xuid:OverwrittingData.get("xuid"))
		//其他玩家个人数据
		OverwrittingData.set("active",data.active!=undefined?data.active:OverwrittingData.get("active"))
		OverwrittingData.set("accept_mode",data.accept_mode!=undefined?data.accept_mode:OverwrittingData.get("accept_mode"))
		OverwrittingData.set("request_available",data.request_available!=undefined?data.request_available:OverwrittingData.get("request_available"))
		OverwrittingData.set("permission_list",data.permission_list!=undefined?data.permission_list:JSON.parse(OverwrittingData.get("permission_list")))
		this.db.setRowFromPrimaryKey(tableName,this.uuid,{
            columnName:"active",
            value:OverwrittingData.get("active")
        },{
            columnName:"accept_mode",
            value:OverwrittingData.get("accept_mode")
        },{
            columnName:"request_available",
            value:OverwrittingData.get("request_available")
        },{
            columnName:"permission_list",
            value:JSON.stringify(OverwrittingData.get("permission_list"))
        },{
			columnName:"name",
			value:OverwrittingData.get("name")
		},{
			columnName:"xuid",
			value:OverwrittingData.get("xuid")
		})
	}
	reload(){
		this.data=this.db.getRowFromPrimaryKey(tableName,this.uuid)
	}
}
class PermissionList{
    data:any
	preference:PlayerPreference
	/**
	 * 
	 * @param {string} uuid 玩家uuid
	 * @param {KVDatabase} db kvdb数据库类实例
	 */
	constructor(uuid:string,db:SQLite3){
		new PlayerPreference(uuid,db);
		this.data=JSON.parse(this.data.get("permissionList"));
	}
	init(){//初始化，数据更新也写在这
		this.preference.init()
		if(this.preference.db.getRowFromPrimaryKey(tableName,this.preference.uuid).get("permissionList")==undefined){
			this.preference.set({permission_list:PermissionList.newPermissionList()})
		}
	}
	/**
	 * 
	 * @param key 写入值的键名
	 * @param data 写入的数据
	 */
	set(key:string,data:any){
		let write=this.data
		write[key]=data
		this.preference.set({permission_list:write})
	}
	isAllowed(uuid:string){
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

export enum AcceptMode{
	Auto,
	Form,
	Command
}

function getAcceptMode(mode:number):AcceptMode{
	switch(mode){
		case 0:return AcceptMode.Auto;
		case 1:return AcceptMode.Form;
		case 2:return AcceptMode.Command;
		default:throw new Error("Invalid AcceptMode");
	}
}


function dbMigration(){
	
	if(!File.ls(data_path).includes("individualpreferences.json"))return;
	Logger.info("正在迁移旧版数据库")
	const oldIndividualPreferences=new JsonFile(data_path+"/individualpreferences.json")
	const veryOldIndividualPreferences=oldIndividualPreferences.get("preferences")
	for(let preference of veryOldIndividualPreferences){
		//Logger.info(`玩家${preference.name}的数据未迁移！正在迁移该玩家的数据`);
		const newPreference=new PlayerPreference(preference.uuid,db)
		newPreference.init()
		newPreference.set({
			active:preference.active,
			accept_mode:preference.acceptmode,
			request_available:preference.requestavailable,
			permission_list:{}
		})
	}
	//通过遍历原来的所有数据来一次性迁移
	//旧数据库有两个版本，都位于同一个文件中，一部分位于根目录直接用键值对存，另一部分位于preferences是一个数组，当前那个数组的读取慢的离谱，所以有了迁移玩家数据这个机制
	//此处不是write了，而是直接在新数据库中插入数据
	/*
	let write = oldIndividualPreferences.get("preferences");
	write.push({ 
		uuid: .uuid,
		name: veryOldIndividualPreferences.get(player.uuid).name, 
		active: veryOldIndividualPreferences.get(player.uuid).active, 
		requestavailable: veryOldIndividualPreferences.get(player.uuid).requestavailable, 
		acceptmode: veryOldIndividualPreferences.get(player.uuid).acceptmode
	});*/
	//全部迁移完成后，不是删除键而是将文件夹重命名为.old结尾
	File.rename(data_path+"/individualpreferences.json",data_path+"/individualpreferences.json.bak")
	//veryOldIndividualPreferences.set("preferences",write);	
	//veryOldIndividualPreferences.delete(player.uuid);	
}

export function getPlayerAcceptMode(playerPreference:PlayerPreference):AcceptMode{
	return getAcceptMode(playerPreference.data.get("accept_mode"));
}

export const economy = new Currency(conf.get("economy").currency);


loaddb()

dbMigration()