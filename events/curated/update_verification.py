#!/usr/bin/env python3
"""One-time script to update verification statuses for Afghanistan events from 1990 onward."""
import json, os

filepath = os.path.join(os.path.dirname(__file__), "afghanistan.json")

with open(filepath, "r", encoding="utf-8") as f:
    events = json.load(f)

sources = {
    (1990, "Failed military coup against Najibullah by Khalq faction"): "https://en.wikipedia.org/wiki/1990_Afghan_coup_attempt",
    (1990, "Opium production expands massively during war years"): "https://en.wikipedia.org/wiki/Opium_production_in_Afghanistan",
    (1991, "Soviet Union collapses ending USSR support for Najibullah"): "https://en.wikipedia.org/wiki/Afghan_Civil_War_(1989%E2%80%931992)",
    (1992, "Najibullah government collapses as mujahideen capture Kabul"): "https://en.wikipedia.org/wiki/Afghan_Civil_War_(1992%E2%80%931996)",
    (1992, "Peshawar Accords create mujahideen transitional government"): "https://en.wikipedia.org/wiki/Peshawar_Accord",
    (1992, "Gulbuddin Hekmatyar begins rocket attacks on Kabul"): "https://www.hrw.org/reports/2005/afghanistan0605/4.htm",
    (1993, "Civil war between mujahideen factions devastates Kabul"): "https://en.wikipedia.org/wiki/Afghan_Civil_War_(1992%E2%80%931996)",
    (1993, "Afshar massacre committed by Sayyaf and Massoud forces"): "https://en.wikipedia.org/wiki/Afshar_Operation",
    (1994, "Taliban movement emerges in Kandahar Province"): "https://en.wikipedia.org/wiki/Taliban",
    (1994, "Taliban captures Kandahar city from mujahideen factions"): "https://en.wikipedia.org/wiki/Taliban",
    (1994, "Pakistan and Saudi Arabia provide covert support to Taliban"): "https://www.hrw.org/reports/2001/afghan2/Afghan0701-02.htm",
    (1995, "Taliban captures Herat Province and imposes strict Islamic law"): "https://en.wikipedia.org/wiki/Ismail_Khan",
    (1995, "Taliban defeats and kills Hezb-e-Wahdat leader Mazari"): "https://en.wikipedia.org/wiki/Abdul_Ali_Mazari",
    (1996, "Taliban captures Kabul and establishes Islamic Emirate of Afghanistan"): "https://en.wikipedia.org/wiki/Afghan_Civil_War_(1992%E2%80%931996)",
    (1996, "Taliban bans women from work, education, and public life"): "https://en.wikipedia.org/wiki/Treatment_of_women_by_the_Taliban",
    (1996, "Northern Alliance formed against Taliban"): "https://en.wikipedia.org/wiki/Northern_Alliance",
    (1996, "Osama bin Laden returns to Afghanistan under Taliban protection"): "https://www.britannica.com/biography/Osama-bin-Laden",
    (1997, "Pakistan and Saudi Arabia recognize Taliban government"): "https://en.wikipedia.org/wiki/Recognition_of_the_Islamic_Emirate_of_Afghanistan",
    (1998, "Al-Qaeda bombs US embassies in Kenya and Tanzania"): "https://www.fbi.gov/history/famous-cases/east-african-embassy-bombings",
    (1998, "US launches cruise missile strikes on Afghan al-Qaeda camps"): "https://en.wikipedia.org/wiki/Operation_Infinite_Reach",
    (1998, "Taliban captures Mazar-e-Sharif and massacres Hazara civilians"): "https://en.wikipedia.org/wiki/1998_Mazar-i-Sharif_massacre",
    (1998, "Massive earthquakes kill thousands in northern Takhar Province"): "https://en.wikipedia.org/wiki/May_30,_1998_Afghanistan_earthquake",
    (1999, "UN imposes sanctions on Taliban over al-Qaeda harboring"): "https://unscr.com/en/resolutions/1267/",
    (1999, "Severe multi-year drought begins devastating Afghan agriculture"): "https://www.fao.org/4/x8669e/x8669e00.htm",
    (2000, "Taliban bans poppy cultivation declaring drugs un-Islamic"): "https://en.wikipedia.org/wiki/Opium_production_in_Afghanistan",
    (2000, "Al-Qaeda attack on USS Cole kills 17 US sailors"): "https://www.fbi.gov/history/famous-cases/uss-cole-bombing",
    (2001, "Taliban destroys ancient Bamiyan Buddha statues"): "https://en.wikipedia.org/wiki/Buddhas_of_Bamiyan",
    (2001, "Ahmad Shah Massoud assassinated by al-Qaeda suicide bombers"): "https://en.wikipedia.org/wiki/Assassination_of_Ahmad_Shah_Massoud",
    (2001, "September 11 attacks trigger US decision to invade Afghanistan"): "https://en.wikipedia.org/wiki/United_States_invasion_of_Afghanistan",
    (2001, "US-led Operation Enduring Freedom begins bombing Afghanistan"): "https://en.wikipedia.org/wiki/Operation_Enduring_Freedom",
    (2001, "Northern Alliance captures Kabul with US air support"): "https://en.wikipedia.org/wiki/Fall_of_Kabul_(2001)",
    (2001, "Battle of Tora Bora: bin Laden escapes into Pakistan"): "https://en.wikipedia.org/wiki/Battle_of_Tora_Bora",
    (2001, "Bonn Agreement establishes Afghan Interim Authority"): "https://en.wikipedia.org/wiki/Bonn_Agreement_(Afghanistan)",
    (2002, "Emergency Loya Jirga selects transitional government under Karzai"): "https://en.wikipedia.org/wiki/2002_loya_jirga",
    (2002, "International Security Assistance Force (ISAF) established in Kabul"): "https://en.wikipedia.org/wiki/International_Security_Assistance_Force",
    (2002, "Afghan refugee repatriation begins with UNHCR assistance"): "https://www.unhcr.org/en-us/news/briefing/2002/5/3ce10537b/afghanistan-refugee-idp-returns.html",
    (2002, "Taliban insurgency begins reforming in Pakistani sanctuaries"): "https://en.wikipedia.org/wiki/Taliban_insurgency",
    (2002, "Operation Anaconda targets al-Qaeda remnants in Shah-i-Kot Valley"): "https://en.wikipedia.org/wiki/Operation_Anaconda",
    (2003, "NATO assumes command of ISAF mission in Afghanistan"): "https://www.nato.int/cps/en/natohq/topics_69366.htm",
    (2003, "Taliban insurgency significantly intensifies in southern Afghanistan"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2003, "US diverts military and intelligence resources to Iraq invasion"): "https://en.wikipedia.org/wiki/2003_invasion_of_Iraq",
    (2004, "New Afghan constitution adopted establishing Islamic Republic"): "https://en.wikipedia.org/wiki/2004_Constitution_of_Afghanistan",
    (2004, "Hamid Karzai elected president in first direct Afghan election"): "https://en.wikipedia.org/wiki/2004_Afghan_presidential_election",
    (2004, "Opium poppy production surges to record levels"): "https://www.unodc.org/pdf/afg/afghanistan_opium_survey_2004.pdf",
    (2004, "Taliban suicide bombing campaign begins targeting civilians"): "https://www.rferl.org/a/1064789.html",
    (2005, "Afghan parliamentary elections held for first time in decades"): "https://en.wikipedia.org/wiki/2005_Afghan_parliamentary_election",
    (2005, "Insurgent attacks increase dramatically across southern Afghanistan"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2006, "NATO expands to southern Afghanistan taking over from US forces"): "https://www.nato.int/cps/en/natohq/news_22206.htm",
    (2006, "Taliban surge in southern Afghanistan largest since 2001"): "https://en.wikipedia.org/wiki/Coalition_combat_operations_in_Afghanistan_in_2006",
    (2007, "Surge in Taliban attacks kills thousands across Afghanistan"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2007, "Afghanistan opium production reaches all-time record"): "https://www.unodc.org/documents/crop-monitoring/Afghanistan-Opium-Survey-2007.pdf",
    (2008, "US increases drone strikes in Pakistani tribal areas"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2008, "Suicide bombing of Indian embassy in Kabul kills 58"): "https://en.wikipedia.org/wiki/2008_bombing_of_Indian_embassy_in_Kabul",
    (2008, "Kandahar prison break frees 1,200 Taliban prisoners"): "https://en.wikipedia.org/wiki/Sarposa_prison_attack_of_2008",
    (2009, "Obama announces 30,000 troop surge to Afghanistan"): "https://www.centcom.mil/MEDIA/NEWS-ARTICLES/News-Article-View/Article/883960/president-calls-for-30000-more-us-troops-in-afghanistan/",
    (2009, "Contested presidential election plunges Afghanistan into political crisis"): "https://en.wikipedia.org/wiki/2009_Afghan_presidential_election",
    (2010, "Operation Moshtarak NATO offensive in Helmand Province"): "https://en.wikipedia.org/wiki/Operation_Moshtarak",
    (2010, "Kabul Bank scandal exposes massive financial fraud"): "https://www.usip.org/publications/2016/12/responding-corruption-and-kabul-bank-collapse",
    (2010, "US Geological Survey reports $1 trillion in Afghan mineral wealth"): "https://en.wikipedia.org/wiki/Mining_in_Afghanistan",
    (2011, "US Navy SEALs kill Osama bin Laden in Abbottabad Pakistan"): "https://en.wikipedia.org/wiki/Killing_of_Osama_bin_Laden",
    (2011, "NATO begins transferring security responsibility to Afghan forces"): "https://www.nato.int/cps/en/natohq/topics_87183.htm",
    (2012, "Quran burning at Bagram triggers nationwide riots killing dozens"): "https://en.wikipedia.org/wiki/2012_Afghanistan_Quran_burning_protests",
    (2012, "Robert Bales massacre kills 16 Afghan civilians in Kandahar"): "https://en.wikipedia.org/wiki/Kandahar_massacre",
    (2012, "Taliban open political office in Doha Qatar"): "https://en.wikipedia.org/wiki/Taliban_in_Qatar",
    (2013, "Afghan forces assume primary security responsibility nationwide"): "https://www.nato.int/cps/en/natohq/topics_87183.htm",
    (2014, "Presidential election crisis resolved by US-brokered National Unity Government"): "https://en.wikipedia.org/wiki/2014_Afghan_presidential_election",
    (2014, "NATO combat mission in Afghanistan formally ends"): "https://en.wikipedia.org/wiki/International_Security_Assistance_Force",
    (2014, "Bilateral Security Agreement signed allowing residual US forces"): "https://en.wikipedia.org/wiki/U.S.%E2%80%93Afghanistan_Strategic_Partnership_Agreement",
    (2015, "Taliban briefly captures Kunduz city in northern Afghanistan"): "https://en.wikipedia.org/wiki/Battle_of_Kunduz_(2015)",
    (2015, "Doctors Without Borders hospital bombed in Kunduz killing 42"): "https://en.wikipedia.org/wiki/Kunduz_hospital_airstrike",
    (2015, "Islamic State (ISIS-K) establishes presence in eastern Afghanistan"): "https://en.wikipedia.org/wiki/Islamic_State_%E2%80%93_Khorasan_Province",
    (2016, "US kills Taliban leader Mullah Akhtar Mansour in drone strike in Pakistan"): "https://en.wikipedia.org/wiki/Death_of_Akhtar_Mansour",
    (2016, "Record 3.5 million Afghans internally displaced by conflict"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2016, "Kabul suicide bombings kill hundreds in multiple mass casualty attacks"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2017, "Massive truck bomb in Kabul diplomatic quarter kills 150"): "https://en.wikipedia.org/wiki/May_2017_Kabul_bombing",
    (2017, "Taliban controls or contests 44% of Afghan territory"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2018, "US-Taliban direct peace negotiations begin in Doha"): "https://en.wikipedia.org/wiki/Afghan_peace_process",
    (2018, "Record Afghan civilian casualties reported by UN"): "https://en.wikipedia.org/wiki/War_in_Afghanistan_(2001%E2%80%932021)",
    (2019, "Presidential election produces disputed result between Ghani and Abdullah"): "https://en.wikipedia.org/wiki/2019_Afghan_presidential_election",
    (2020, "US-Taliban Doha Agreement signed for phased withdrawal"): "https://en.wikipedia.org/wiki/United_States%E2%80%93Taliban_deal",
    (2020, "Intra-Afghan peace talks open in Doha"): "https://en.wikipedia.org/wiki/United_States%E2%80%93Taliban_deal",
    (2020, "COVID-19 pandemic overwhelms Afghan health system"): "https://pmc.ncbi.nlm.nih.gov/articles/PMC7506810/",
    (2021, "Biden administration announces complete US withdrawal"): "https://en.wikipedia.org/wiki/2020%E2%80%932021_U.S._troop_withdrawal_from_Afghanistan",
    (2021, "Taliban launches rapid military offensive capturing all provincial capitals"): "https://en.wikipedia.org/wiki/2021_Taliban_offensive",
    (2021, "Taliban captures Kabul and Afghan government collapses"): "https://en.wikipedia.org/wiki/Fall_of_Kabul_(2021)",
    (2021, "Chaotic Kabul airport evacuation of 120,000 people"): "https://en.wikipedia.org/wiki/2021_Kabul_airlift",
    (2021, "ISIS-K suicide bombing at Kabul airport kills 170 including 13 US troops"): "https://en.wikipedia.org/wiki/2021_Kabul_airport_attack",
    (2021, "Islamic Emirate of Afghanistan re-established by Taliban"): "https://en.wikipedia.org/wiki/2021_Taliban_offensive",
    (2021, "Taliban bans women from secondary education and most employment"): "https://en.wikipedia.org/wiki/Treatment_of_women_by_the_Taliban",
    (2021, "US freezes $9.5 billion in Afghan central bank reserves"): "https://www.aljazeera.com/economy/2021/8/18/us-freezes-afghan-central-banks-assets-of-9-5bn",
    (2022, "Catastrophic humanitarian crisis as 23 million face acute hunger"): "https://www.unocha.org/publications/report/afghanistan/afghanistan-humanitarian-needs-overview-2022-january-2022",
    (2022, "Taliban bans women from universities completing total educational exclusion"): "https://www.aljazeera.com/news/2022/12/20/taliban-says-women-banned-from-universities-in-afghanistan",
    (2022, "Devastating earthquake kills 1,000 in Paktika and Khost provinces"): "https://en.wikipedia.org/wiki/June_2022_Afghanistan_earthquake",
    (2022, "US kills al-Qaeda leader Ayman al-Zawahiri in Kabul drone strike"): "https://en.wikipedia.org/wiki/Killing_of_Ayman_al-Zawahiri",
    (2022, "Afghan economy contracts by 20-30% since Taliban takeover"): "https://www.hrw.org/news/2022/08/04/economic-causes-afghanistans-humanitarian-crisis",
    (2022, "ISKP launches major attacks on Taliban military and Shia civilians"): "https://www.hrw.org/news/2022/09/06/afghanistan-isis-group-targets-religious-minorities",
    (2023, "Taliban bans women from working for NGOs and UN agencies"): "https://news.un.org/en/story/2023/04/1135357",
    (2023, "Massive 6.3 magnitude earthquakes kill 1,400 in Herat Province"): "https://en.wikipedia.org/wiki/2023_Herat_earthquakes",
    (2023, "UN Special Rapporteur accuses Taliban of gender apartheid"): "https://www.ohchr.org/en/stories/2023/07/experts-taliban-treatment-women-may-be-gender-apartheid",
    (2023, "Taliban resumes public executions and amputations"): "https://www.hrw.org/news/2023/05/08/corporal-punishment-rise-afghanistan",
    (2023, "Pakistan orders expulsion of 1.7 million Afghan refugees"): "https://en.wikipedia.org/wiki/Deportation_of_undocumented_Afghans_from_Pakistan",
    (2024, "Taliban enacts Law on Promotion of Virtue and Prevention of Vice"): "https://www.uscirf.gov/publications/issue-update-afghanistan-assessing-law-propagation-virtue-and-prevention-vice",
    (2024, "Catastrophic flooding kills hundreds across northern Afghanistan"): "https://reliefweb.int/disaster/fl-2024-000038-afg",
    (2024, "ISKP conducts major attack on Moscow concert hall killing 145"): "https://en.wikipedia.org/wiki/Crocus_City_Hall_attack",
    (2025, "Pakistan-Afghanistan border tensions escalate over Durand Line"): "https://www.britannica.com/topic/Afghanistan-Pakistan-Conflict-2025",
    (2025, "Taliban bans women from speaking in public and enforces full face veil"): "https://en.wikipedia.org/wiki/Treatment_of_women_by_the_Taliban",
    (2025, "International Court of Justice case on Taliban gender apartheid advances"): "https://feminist.org/news/four-countries-to-take-taliban-to-the-international-court-of-justice-over-gender-apartheid/",
}

updated = 0
unmatched = []
for event in events:
    if event["year"] >= 1990:
        key = (event["year"], event["title"])
        if key in sources:
            event["verified"] = True
            event["verification_source"] = sources[key]
            updated += 1
        else:
            unmatched.append(f"[{event['year']}] {event['title']}")

print(f"Updated: {updated}/107")
if unmatched:
    for u in unmatched:
        print(f"UNMATCHED: {u}")

with open(filepath, "w", encoding="utf-8") as f:
    json.dump(events, f, indent=2, ensure_ascii=False)

print("File written successfully.")
