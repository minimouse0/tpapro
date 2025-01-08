import { Currency, SQLDataType, SQLDataTypeEnum, SQLite3 } from "../lib";
import { data_path } from "../lib/plugin_info.js"
import { conf } from "./conf.js";

export const db=new SQLite3(data_path+"/data.db")

//创建玩家个人设置表
db.initTable("individualpreferences",
    {
        name:"uuid",
        data_type:new SQLDataType(SQLDataTypeEnum.TEXT),
        constraint:{
            primary_key:true
        }
    },
    {
        name:"permissionList",
        data_type:new SQLDataType(SQLDataTypeEnum.TEXT)
    }
)

export class PlayerPreference{
    uuid:string
    db:SQLite3
    data:Map<string,any>
	constructor(uuid:string,db:SQLite3){
		this.uuid=uuid;
		this.db=db;
		this.init();
		this.data=this.db.getRowFromPrimaryKey("individualpreferences",this.uuid)
	}
	init(){//初始化，数据更新也写在这
		if(this.db.getRowFromPrimaryKey("individualpreferences",(this.uuid)==null)){
            //不给出任何列的话好像是只会创建一个空行
			this.db.setRowFromPrimaryKey("individualpreferences",this.uuid)
		}
	}
	set(key:string,data:any){
		this.db.setRowFromPrimaryKey("individualpreferences",this.uuid,{
            columnName:key,
            value:JSON.stringify(data)
        })
	}
}
class PermissionList extends PlayerPreference{//用类继承来表示各个配置项的从属关系
    data:any
	/**
	 * 
	 * @param {string} uuid 玩家uuid
	 * @param {KVDatabase} db kvdb数据库类实例
	 */
	constructor(uuid:string,db:SQLite3){
		super(uuid,db);
		this.data=JSON.parse(this.data.get("permissionList"));
	}
	init(){//初始化，数据更新也写在这
		super.init()
		if(this.db.getRowFromPrimaryKey("individualpreferences",this.uuid).get("permissionList")==undefined){
			super.set("permissionList",PermissionList.newPermissionList())
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
		super.set("permissionList",JSON.stringify(write))
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

export function getPlayerAcceptMode(playerPreference:PlayerPreference):AcceptMode{
	return getAcceptMode(playerPreference.data.get("accept_mode"));
}

export const economy = new Currency(conf.get("economy").object);