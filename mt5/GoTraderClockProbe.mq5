// GoTrader V2 terminal clock probe. Read-only diagnostics only.
#property copyright "GoTrader"
#property version   "1.00"
#property script_show_inputs
#property strict

input string InpSymbol = "USTECH";

const string SCHEMA_ID = "gotrader-mt5-terminal-clock-observation";
const string SCHEMA_VERSION = "1.0.0";
const string OUTPUT_DIRECTORY = "GoTrader";

string JsonEscape(const string value)
  {
   string result="";
   for(int index=0; index<StringLen(value); index++)
     {
      ushort character=StringGetCharacter(value,index);
      if(character=='\\') result+="\\\\";
      else if(character=='\"') result+="\\\"";
      else if(character=='\n') result+="\\n";
      else if(character=='\r') result+="\\r";
      else if(character=='\t') result+="\\t";
      else if(character>=32) result+=ShortToString(character);
     }
   return result;
  }

string JsonBool(const bool value)
  {
   return value ? "true" : "false";
  }

string LongText(const long value)
  {
   return StringFormat("%I64d",value);
  }

string ULongText(const ulong value)
  {
   return StringFormat("%I64u",value);
  }

uint Fnv1a32(const string value)
  {
   uint hash=2166136261;
   for(int index=0; index<StringLen(value); index++)
     {
      hash^=(uint)StringGetCharacter(value,index);
      hash*=16777619;
     }
   return hash;
  }

bool WriteAtomicCommonJson(const string relative_name,const string payload)
  {
   if(!FolderCreate(OUTPUT_DIRECTORY,FILE_COMMON) && GetLastError()!=5010)
     {
      PrintFormat("GoTrader clock probe could not create common directory. Error=%d",GetLastError());
      ResetLastError();
     }
   string temporary_name=relative_name+".tmp";
   int handle=FileOpen(
      temporary_name,
      FILE_WRITE|FILE_TXT|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ,
      0,
      CP_UTF8
   );
   if(handle==INVALID_HANDLE)
     {
      PrintFormat("GoTrader clock probe could not open temporary output. Error=%d",GetLastError());
      return false;
     }
   FileWriteString(handle,payload);
   FileFlush(handle);
   FileClose(handle);
   ResetLastError();
   if(!FileMove(temporary_name,FILE_COMMON,relative_name,FILE_COMMON|FILE_REWRITE))
     {
      PrintFormat("GoTrader clock probe could not atomically replace output. Error=%d",GetLastError());
      FileDelete(temporary_name,FILE_COMMON);
      return false;
     }
   return true;
  }

void OnStart()
  {
   const ulong capture_started_ms=GetTickCount64();
   const datetime time_current=TimeCurrent();
   const datetime time_trade_server=TimeTradeServer();
   const datetime time_gmt=TimeGMT();
   const datetime time_local=TimeLocal();
   const int time_gmt_offset=TimeGMTOffset();
   const int daylight_savings=TimeDaylightSavings();

   const bool synchronized=SymbolIsSynchronized(InpSymbol);
   MqlTick tick={};
   const bool tick_succeeded=SymbolInfoTick(InpSymbol,tick);
   long symbol_time=0;
   long symbol_time_msc=0;
   if(tick_succeeded)
     {
      symbol_time=(long)tick.time;
      symbol_time_msc=(long)tick.time_msc;
     }
   else
     {
      SymbolInfoInteger(InpSymbol,SYMBOL_TIME,symbol_time);
      SymbolInfoInteger(InpSymbol,SYMBOL_TIME_MSC,symbol_time_msc);
     }

   MqlRates rates[];
   ArraySetAsSeries(rates,true);
   const int copied=CopyRates(InpSymbol,PERIOD_M5,0,1,rates);
   const bool bar_succeeded=(copied==1);
   const long latest_bar_open=bar_succeeded ? (long)rates[0].time : 0;
   const long latest_bar_index=bar_succeeded ? 0 : -1;
   const int terminal_build=(int)TerminalInfoInteger(TERMINAL_BUILD);
   const string terminal_data_path=TerminalInfoString(TERMINAL_DATA_PATH);
   const string instance_id=StringFormat("%08X",Fnv1a32(terminal_data_path));
   const ulong sequence=GetTickCount64();
   const string observation_id=instance_id+"-"+ULongText(sequence)+"-"+LongText(symbol_time);
   const long capture_duration=(long)(GetTickCount64()-capture_started_ms);

   string json="{";
   json+="\"schemaId\":\""+SCHEMA_ID+"\",";
   json+="\"version\":\""+SCHEMA_VERSION+"\",";
   json+="\"observationId\":\""+JsonEscape(observation_id)+"\",";
   json+="\"sequence\":"+ULongText(sequence)+",";
   json+="\"probeInstanceId\":\""+instance_id+"\",";
   json+="\"symbol\":\""+JsonEscape(InpSymbol)+"\",";
   json+="\"timeframe\":\"M5\",";
   json+="\"captureDurationMs\":"+LongText(capture_duration)+",";
   json+="\"timeCurrentRaw\":"+LongText((long)time_current)+",";
   json+="\"timeTradeServerRaw\":"+LongText((long)time_trade_server)+",";
   json+="\"timeGmtRaw\":"+LongText((long)time_gmt)+",";
   json+="\"timeLocalRaw\":"+LongText((long)time_local)+",";
   json+="\"timeGmtOffsetSeconds\":"+IntegerToString(time_gmt_offset)+",";
   json+="\"timeDaylightSavingsSeconds\":"+IntegerToString(daylight_savings)+",";
   json+="\"symbolTimeRaw\":"+LongText(symbol_time)+",";
   json+="\"symbolTimeMscRaw\":"+LongText(symbol_time_msc)+",";
   json+="\"latestBarOpenRaw\":"+LongText(latest_bar_open)+",";
   json+="\"latestBarIndex\":"+LongText(latest_bar_index)+",";
   json+="\"symbolSynchronized\":"+JsonBool(synchronized)+",";
   json+="\"tickReadSucceeded\":"+JsonBool(tick_succeeded)+",";
   json+="\"barReadSucceeded\":"+JsonBool(bar_succeeded)+",";
   json+="\"terminalBuild\":"+IntegerToString(terminal_build)+",";
   json+="\"authority\":{\"executionAuthority\":\"none\",\"brokerAuthority\":\"none\",\"readinessOverrideAuthority\":\"none\"},";
   json+="\"executionAuthority\":\"none\",";
   json+="\"brokerAuthority\":\"none\",";
   json+="\"readinessOverrideAuthority\":\"none\"";
   json+="}";

   const string output_name=OUTPUT_DIRECTORY+"\\gotrader-mt5-clock-probe-"+instance_id+".json";
   if(WriteAtomicCommonJson(output_name,json))
     {
      PrintFormat(
         "GoTrader read-only clock observation written: %s\\MQL5\\Files\\%s",
         TerminalInfoString(TERMINAL_COMMONDATA_PATH),
         output_name
      );
     }
  }
