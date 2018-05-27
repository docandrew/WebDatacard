import vibe.d;

final class WebDataCard 
{
	void getTaf(string icao, string time, HTTPServerResponse tafres)
	{

		logInfo("got request for TAF " ~ icao ~ " at " ~ time);
		string tafxml;

		requestHTTP("http://www.aviationweather.gov/adds/dataserver_current/httpparam?datasource=tafs&requesttype=retrieve&format=xml&mostRecentForEachStation=constraint&stationString=" ~ icao ~ "&hoursBeforeNow=0&timeType=valid",
			(scope req)
			{

			},
			(scope res)
			{
				//logInfo("Response from ADDS: %s", res.bodyReader.readAllUTF8());
				tafxml = res.bodyReader.readAllUTF8();
			});

		//TODO: parse xml and send JSON back to client
		logInfo(tafxml);
		tafres.writeBody(tafxml);
	}
}

shared static this()
{
	auto router = new URLRouter;
	router.registerWebInterface(new WebDataCard);
	//router.get("/getHours", &getHours);
    router.get("*", serveStaticFiles("public/"));

	auto settings = new HTTPServerSettings;
	settings.port = 8080;
	settings.bindAddresses = ["::1", "127.0.0.1"];
	listenHTTP(settings, router);

	logInfo("Please open http://127.0.0.1:8080/ in your browser.");
}
