-- ============================================================
-- Solar Kita: demo seed aligned with the frontend (src/data.ts)
-- Generated from the app's own data so ids, prices, units and
-- the demo resident's holdings match what the UI shows.
--
-- Run in the Supabase SQL Editor AFTER schema.txt.
-- WARNING: this wipes every public.* table (profiles included) and
-- re-creates demo data. Mock/demo projects only.
--
-- Demo resident (must already exist in Authentication > Users):
--   7ea49052-2efb-43a6-9e49-de479be5721a
-- 12 demo neighbours are (re)created as auth users
-- (neighbourNN@demo.solarkita.my, no password) so every "taken" unit
-- in the app is a real subscription row owned by someone.
-- ============================================================

-- ----------------------------
-- 0. Schema additions used by the frontend (safe to re-run)
-- ----------------------------
alter table public.townships
  add column if not exists map_seed integer,
  add column if not exists map_layout jsonb;

alter table public.sites
  add column if not exists grid_cols integer not null default 1 check (grid_cols > 0),
  add column if not exists map_x smallint check (map_x between 0 and 3),
  add column if not exists map_z smallint check (map_z between 0 and 3),
  add column if not exists output_pct numeric(5,2) check (output_pct between 0 and 100);

begin;

-- ----------------------------
-- 1. Reset
-- ----------------------------
do $$
begin
  if not exists (select 1 from auth.users where id = '7ea49052-2efb-43a6-9e49-de479be5721a') then
    raise exception 'Demo user 7ea49052-2efb-43a6-9e49-de479be5721a not found in auth.users. Create it in Authentication > Users first, or change the id in this file.';
  end if;
end $$;

truncate table
  public.messages, public.conversations, public.notification_deliveries, public.alert_reads,
  public.alerts, public.alert_incidents, public.notification_preferences, public.solar_readings,
  public.daily_checkins, public.redemptions, public.point_ledger, public.payouts, public.contributions,
  public.subscription_units, public.subscriptions, public.profiles, public.rewards, public.sites,
  public.townships
restart identity cascade;

delete from auth.users where email like '%@demo.solarkita.my';

-- ----------------------------
-- 2. Townships (15)
-- ----------------------------
insert into public.townships
  (id, name, area, state, latitude, longitude, photo_url, community_mwh, residents_count, map_seed, map_layout)
values
  ('elmina', 'City of Elmina', 'Shah Alam', 'Selangor', 3.1804, 101.5173, 'photos/elmina_3.jpg', 12.4, 2140, 11, '{"lake":[2,0],"park":[1,1],"towers":[[0,0]]}'::jsonb),
  ('bukit-raja', 'Bandar Bukit Raja', 'Klang', 'Selangor', 3.0852, 101.4377, 'photos/bandar_bukit_raja.jpg', 9.8, 1710, 23, '{"lake":[0,3],"park":[2,1],"towers":[[1,0],[0,1]]}'::jsonb),
  ('serenia', 'Serenia City', 'Sepang', 'Selangor', 2.8454, 101.7046, 'photos/serenia_city.jpg', 15.1, 2680, 37, '{"lake":[1,2],"park":[3,3],"towers":[[0,0]]}'::jsonb),
  ('ara', 'Ara Damansara', 'Petaling Jaya', 'Selangor', 3.1084, 101.5866, 'photos/ara_damansara.jpg', 7.6, 1290, 51, '{"lake":[3,1],"park":[0,2],"towers":[[1,0],[2,0]]}'::jsonb),
  ('subang-jaya', 'Subang Jaya & USJ', 'Subang Jaya', 'Selangor', 3.0757, 101.5861, null, 18.2, 3420, 63, '{"lake":[0,0],"park":[1,0],"towers":[[1,3]]}'::jsonb),
  ('putra-heights', 'Putra Heights', 'Subang Jaya', 'Selangor', 2.9961, 101.5756, null, 8.9, 1580, 71, '{"lake":[3,0],"park":[2,2],"towers":[[1,0]]}'::jsonb),
  ('bukit-jelutong', 'Bukit Jelutong', 'Shah Alam', 'Selangor', 3.1002, 101.5375, null, 10.3, 1840, 79, '{"lake":[0,3],"park":[2,1],"towers":[[3,0]]}'::jsonb),
  ('denai-alam', 'Denai Alam', 'Shah Alam', 'Selangor', 3.1636, 101.513, null, 6.8, 1190, 83, '{"lake":[2,1],"park":[2,2],"towers":[[2,1]]}'::jsonb),
  ('saujana-impian', 'Saujana Impian', 'Kajang', 'Selangor', 3.0127, 101.7902, null, 5.9, 1020, 89, '{"lake":[3,0],"park":[3,3],"towers":[[0,0]]}'::jsonb),
  ('melawati', 'Taman Melawati', 'Ulu Kelang', 'Selangor', 3.2134, 101.752, null, 7.2, 1340, 97, '{"lake":[2,0],"park":[3,2],"towers":[[1,1]]}'::jsonb),
  ('klgcc', 'KLGCC Resort', 'Bukit Kiara', 'Kuala Lumpur', 3.14, 101.6397, null, 4.1, 620, 101, '{"lake":[0,3],"park":[2,2],"towers":[[1,2]]}'::jsonb),
  ('nilai-impian', 'Nilai Impian', 'Nilai', 'Negeri Sembilan', 2.846, 101.806, null, 6.4, 1260, 107, '{"lake":[3,1],"park":[2,2],"towers":[[3,1]]}'::jsonb),
  ('planters-haven', 'Planters'' Haven', 'Nilai', 'Negeri Sembilan', 2.7935, 101.8052, null, 3.6, 540, 113, '{"lake":[2,2],"park":[1,1],"towers":[[1,0]]}'::jsonb),
  ('ainsdale', 'Bandar Ainsdale', 'Seremban', 'Negeri Sembilan', 2.7304, 101.8882, null, 5.2, 980, 127, '{"lake":[0,3],"park":[3,2],"towers":[[3,1]]}'::jsonb),
  ('pagoh', 'Bandar Universiti Pagoh', 'Muar', 'Johor', 2.1531, 102.7304, null, 4.8, 760, 131, '{"lake":[0,3],"park":[0,0],"towers":[[0,3]]}'::jsonb);

-- ----------------------------
-- 3. Sites (52). co2 is stored in kg (frontend shows tonnes)
-- ----------------------------
insert into public.sites
  (id, township_id, kind, name, description, price_per_unit, return_low_pct, return_high_pct,
   points_per_unit, co2_kg_per_unit_year, kwp_per_unit, total_units, capacity_mw,
   generation_target_kwh_day, homes_powered, status, since_date, grid_cols, map_x, map_z, output_pct)
values
  ('elmina-subscription', 'elmina', 'subscription', 'Elmina Sunfield', 'A community solar farm beside Elmina Lakes, supplying clean energy to homes and shops across the township.', 1000, 4, 6, 200, 1200, 10, 14, 5, 22000, 1200, 'active', '2024-01-01', 2, 2, 2, 56),
  ('elmina-investment', 'elmina', 'investment', 'Elmina Grid Array', 'Utility-scale array feeding the Elmina substation. Larger units, longer horizon, stronger returns.', 50000, 6, 9, 500, 30000, 250, 18, 12, 52800, 3100, 'active', '2023-06-01', 2, 3, 0, 61),
  ('elmina-rooftop', 'elmina', 'rooftop', 'Elmina West Homes', 'Six family homes in Elmina West ready for rooftop solar. Help fund a roof, share the savings.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-03-01', 3, 0, 1, 48),
  ('elmina-ev', 'elmina', 'ev', 'Elmina Hub Chargers', 'Solar canopy over the Elmina Hub EV bays. Every unit you fund powers real drives around town.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2024-08-01', 4, 1, 3, 72),
  ('bukit-raja-subscription', 'bukit-raja', 'subscription', 'Bukit Raja Meadow', 'Gentle hillside farm overlooking Bukit Raja park, with plenty of rows still open for neighbours.', 1000, 4, 6, 200, 1200, 10, 14, 4, 17600, 980, 'active', '2024-01-01', 2, 1, 2, 52),
  ('bukit-raja-rooftop', 'bukit-raja', 'rooftop', 'Raja Terrace Roofs', 'Terrace homes near the community centre lining up for rooftop panels.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-05-01', 3, 0, 0, 45),
  ('bukit-raja-ev', 'bukit-raja', 'ev', 'Raja Mall Chargers', 'Shoppers charge under a solar roof at Bukit Raja mall.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2025-02-01', 4, 2, 3, 68),
  ('serenia-subscription', 'serenia', 'subscription', 'Serenia Sunrise Farm', 'Serenia’s flagship solar farm with the best morning sun in the region.', 1000, 4, 6, 200, 1200, 10, 14, 6, 26400, 1500, 'active', '2024-01-01', 2, 2, 1, 63),
  ('serenia-investment', 'serenia', 'investment', 'Serenia Array One', 'Large-scale solar asset powering Serenia’s business district.', 50000, 6, 9, 500, 30000, 250, 18, 15, 66000, 3900, 'active', '2023-11-01', 2, 0, 1, 66),
  ('serenia-rooftop', 'serenia', 'rooftop', 'Serenia Garden Homes', 'Garden homes by the lake ready to go solar.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-04-01', 3, 3, 2, 50),
  ('ara-subscription', 'ara', 'subscription', 'Ara Rooftop Park', 'A compact urban solar park tucked between Ara’s condos and the lake.', 1000, 4, 6, 200, 1200, 10, 14, 3, 13200, 700, 'active', '2024-01-01', 2, 2, 2, 49),
  ('ara-ev', 'ara', 'ev', 'Ara Station Chargers', 'Commuter EV bays at Ara station, topped with solar.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2024-09-01', 4, 1, 1, 70),
  ('subang-jaya-rooftop', 'subang-jaya', 'rooftop', 'Subang Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Subang Jaya & USJ.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-03-01', 3, 2, 3, 70),
  ('subang-jaya-subscription', 'subang-jaya', 'subscription', 'Subang Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Subang Jaya & USJ.', 1000, 4, 6, 200, 1200, 10, 14, 4, 17600, 1184, 'active', '2024-03-01', 2, 3, 1, 59),
  ('subang-jaya-ev', 'subang-jaya', 'ev', 'Subang EV Hub', 'Solar-powered EV charging for a cleaner commute in Subang Jaya & USJ.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2025-01-01', 4, 3, 0, 55),
  ('subang-jaya-investment', 'subang-jaya', 'investment', 'Subang Grid Array', 'Invest in larger solar assets for long-term value in Subang Jaya & USJ.', 50000, 6, 9, 500, 30000, 250, 18, 11, 48400, 3411, 'active', '2024-03-01', 2, 2, 1, 51),
  ('putra-heights-rooftop', 'putra-heights', 'rooftop', 'Putra Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Putra Heights.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-03-01', 3, 0, 0, 58),
  ('putra-heights-subscription', 'putra-heights', 'subscription', 'Putra Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Putra Heights.', 1000, 4, 6, 200, 1200, 10, 14, 5, 22000, 1415, 'active', '2024-07-01', 2, 2, 0, 57),
  ('putra-heights-ev', 'putra-heights', 'ev', 'Putra EV Hub', 'Solar-powered EV charging for a cleaner commute in Putra Heights.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2025-05-01', 4, 1, 2, 45),
  ('putra-heights-investment', 'putra-heights', 'investment', 'Putra Grid Array', 'Invest in larger solar assets for long-term value in Putra Heights.', 50000, 6, 9, 500, 30000, 250, 18, 8, 35200, 3211, 'active', '2024-03-01', 2, 0, 1, 69),
  ('bukit-jelutong-rooftop', 'bukit-jelutong', 'rooftop', 'Bukit Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Bukit Jelutong.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2025-05-01', 3, 1, 2, 56),
  ('bukit-jelutong-subscription', 'bukit-jelutong', 'subscription', 'Bukit Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Bukit Jelutong.', 1000, 4, 6, 200, 1200, 10, 14, 4, 17600, 1494, 'active', '2025-05-01', 2, 2, 3, 66),
  ('bukit-jelutong-ev', 'bukit-jelutong', 'ev', 'Bukit EV Hub', 'Solar-powered EV charging for a cleaner commute in Bukit Jelutong.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2025-01-01', 4, 0, 1, 69),
  ('bukit-jelutong-investment', 'bukit-jelutong', 'investment', 'Bukit Grid Array', 'Invest in larger solar assets for long-term value in Bukit Jelutong.', 50000, 6, 9, 500, 30000, 250, 18, 11, 48400, 2037, 'active', '2024-07-01', 2, 0, 0, 58),
  ('denai-alam-rooftop', 'denai-alam', 'rooftop', 'Denai Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Denai Alam.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2025-01-01', 3, 1, 2, 52),
  ('denai-alam-subscription', 'denai-alam', 'subscription', 'Denai Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Denai Alam.', 1000, 4, 6, 200, 1200, 10, 14, 6, 26400, 1146, 'active', '2025-01-01', 2, 1, 3, 62),
  ('denai-alam-ev', 'denai-alam', 'ev', 'Denai EV Hub', 'Solar-powered EV charging for a cleaner commute in Denai Alam.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2025-05-01', 4, 0, 2, 61),
  ('denai-alam-investment', 'denai-alam', 'investment', 'Denai Grid Array', 'Invest in larger solar assets for long-term value in Denai Alam.', 50000, 6, 9, 500, 30000, 250, 18, 8, 35200, 2495, 'active', '2024-03-01', 2, 2, 3, 55),
  ('saujana-impian-subscription', 'saujana-impian', 'subscription', 'Saujana Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Saujana Impian.', 1000, 4, 6, 200, 1200, 10, 14, 6, 26400, 726, 'active', '2025-05-01', 2, 0, 2, 68),
  ('saujana-impian-investment', 'saujana-impian', 'investment', 'Saujana Grid Array', 'Invest in larger solar assets for long-term value in Saujana Impian.', 50000, 6, 9, 500, 30000, 250, 18, 9, 39600, 2208, 'active', '2025-01-01', 2, 0, 3, 69),
  ('saujana-impian-rooftop', 'saujana-impian', 'rooftop', 'Saujana Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Saujana Impian.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-03-01', 3, 1, 1, 63),
  ('melawati-subscription', 'melawati', 'subscription', 'Melawati Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Taman Melawati.', 1000, 4, 6, 200, 1200, 10, 14, 6, 26400, 1231, 'active', '2024-07-01', 2, 3, 1, 55),
  ('melawati-investment', 'melawati', 'investment', 'Melawati Grid Array', 'Invest in larger solar assets for long-term value in Taman Melawati.', 50000, 6, 9, 500, 30000, 250, 18, 13, 57200, 3099, 'active', '2024-07-01', 2, 0, 2, 48),
  ('melawati-rooftop', 'melawati', 'rooftop', 'Melawati Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Taman Melawati.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2025-05-01', 3, 1, 3, 48),
  ('klgcc-subscription', 'klgcc', 'subscription', 'KLGCC Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in KLGCC Resort.', 1000, 4, 6, 200, 1200, 10, 14, 5, 22000, 670, 'active', '2025-01-01', 2, 3, 0, 62),
  ('klgcc-investment', 'klgcc', 'investment', 'KLGCC Grid Array', 'Invest in larger solar assets for long-term value in KLGCC Resort.', 50000, 6, 9, 500, 30000, 250, 18, 11, 48400, 2295, 'active', '2024-07-01', 2, 1, 0, 52),
  ('klgcc-rooftop', 'klgcc', 'rooftop', 'KLGCC Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in KLGCC Resort.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2025-01-01', 3, 1, 3, 63),
  ('nilai-impian-rooftop', 'nilai-impian', 'rooftop', 'Nilai Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Nilai Impian.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-07-01', 3, 3, 3, 68),
  ('nilai-impian-subscription', 'nilai-impian', 'subscription', 'Nilai Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Nilai Impian.', 1000, 4, 6, 200, 1200, 10, 14, 6, 26400, 1322, 'active', '2025-05-01', 2, 3, 2, 60),
  ('nilai-impian-ev', 'nilai-impian', 'ev', 'Nilai EV Hub', 'Solar-powered EV charging for a cleaner commute in Nilai Impian.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2024-07-01', 4, 1, 2, 46),
  ('nilai-impian-investment', 'nilai-impian', 'investment', 'Nilai Grid Array', 'Invest in larger solar assets for long-term value in Nilai Impian.', 50000, 6, 9, 500, 30000, 250, 18, 10, 44000, 2488, 'active', '2024-03-01', 2, 2, 1, 48),
  ('planters-haven-subscription', 'planters-haven', 'subscription', 'Planters'' Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Planters'' Haven.', 1000, 4, 6, 200, 1200, 10, 14, 3, 13200, 745, 'active', '2024-03-01', 2, 2, 3, 51),
  ('planters-haven-investment', 'planters-haven', 'investment', 'Planters'' Grid Array', 'Invest in larger solar assets for long-term value in Planters'' Haven.', 50000, 6, 9, 500, 30000, 250, 18, 11, 48400, 2839, 'active', '2024-07-01', 2, 2, 0, 68),
  ('planters-haven-rooftop', 'planters-haven', 'rooftop', 'Planters'' Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Planters'' Haven.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2024-07-01', 3, 3, 1, 55),
  ('ainsdale-rooftop', 'ainsdale', 'rooftop', 'Ainsdale Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Bandar Ainsdale.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2025-05-01', 3, 1, 1, 46),
  ('ainsdale-subscription', 'ainsdale', 'subscription', 'Ainsdale Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Bandar Ainsdale.', 1000, 4, 6, 200, 1200, 10, 14, 5, 22000, 678, 'active', '2025-05-01', 2, 2, 3, 53),
  ('ainsdale-ev', 'ainsdale', 'ev', 'Ainsdale EV Hub', 'Solar-powered EV charging for a cleaner commute in Bandar Ainsdale.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2024-03-01', 4, 1, 3, 54),
  ('ainsdale-investment', 'ainsdale', 'investment', 'Ainsdale Grid Array', 'Invest in larger solar assets for long-term value in Bandar Ainsdale.', 50000, 6, 9, 500, 30000, 250, 18, 13, 57200, 2149, 'active', '2024-07-01', 2, 3, 0, 62),
  ('pagoh-rooftop', 'pagoh', 'rooftop', 'Universiti Rooftop Homes', 'Solar for homes, cleaner neighbourhoods in Bandar Universiti Pagoh.', 8000, 5, 8, 100, 3100, 6, 6, 0.04, 176, 6, 'active', '2025-01-01', 3, 0, 2, 53),
  ('pagoh-subscription', 'pagoh', 'subscription', 'Universiti Solar Park', 'Flexible subscription for community-scale solar. Support utility-scale solar and enjoy clean energy returns in Bandar Universiti Pagoh.', 1000, 4, 6, 200, 1200, 10, 14, 3, 13200, 1352, 'active', '2024-07-01', 2, 2, 0, 65),
  ('pagoh-ev', 'pagoh', 'ev', 'Universiti EV Hub', 'Solar-powered EV charging for a cleaner commute in Bandar Universiti Pagoh.', 10000, 5, 8, 300, 4200, 20, 8, 0.04, 176, 0, 'active', '2024-03-01', 4, 1, 3, 68),
  ('pagoh-investment', 'pagoh', 'investment', 'Universiti Grid Array', 'Invest in larger solar assets for long-term value in Bandar Universiti Pagoh.', 50000, 6, 9, 500, 30000, 250, 18, 12, 52800, 2609, 'active', '2024-03-01', 2, 2, 2, 47);

-- ----------------------------
-- 4. Rewards (7)
-- ----------------------------
insert into public.rewards (id, title, value_label, detail, cost_points, category, icon, photo_url, active)
values
  ('sdp50', 'Sime Darby Property Shopping Voucher', 'RM50', 'Shop, dine and live greener at Sime Darby Property malls and partners.', 1000, 'shopping', 'ticket', null, true),
  ('ev20', 'EV Charging Credits', 'RM20', 'Charging credit at any township EV charger.', 800, 'mobility', 'plug-zap', 'photos/ev_charger.jpg', true),
  ('shop50', 'Retail Shopping Voucher', 'RM50', 'E-voucher for selected retail partners in our townships.', 1200, 'shopping', 'shopping-bag', 'photos/shopping_bag.jpg', true),
  ('appliance', 'Green Home Appliance Rebate', 'RM100', 'Rebate on selected energy-efficient home appliances.', 2000, 'home', 'refrigerator', 'photos/energy_efficient_appliances.jpg', true),
  ('park10', 'Township Parking Credit', 'RM10', 'Parking credit at participating township car parks.', 500, 'mobility', 'square-parking', 'photos/solar_car_park.jpg', true),
  ('tree', 'Tree-Planting Donation', '1 tree', 'Plant a native tree in Sime Darby Property townships, tagged in your name.', 1000, 'community', 'sprout', 'photos/tree_planting_hands.jpg', true),
  ('garden', 'Community Garden Plot', '3 months', 'Your own plot at the township community garden.', 1500, 'community', 'flower-2', 'photos/seedling_hands.jpg', true);

-- ----------------------------
-- 5. People: demo resident + neighbours
-- (the on_auth_user_created trigger creates neighbour profiles + preferences)
-- ----------------------------
insert into public.profiles (id, full_name, township_id, app_role, map_mode)
values ('7ea49052-2efb-43a6-9e49-de479be5721a', 'Jane Doe', 'elmina', 'resident', '3d');
insert into public.notification_preferences (user_id) values ('7ea49052-2efb-43a6-9e49-de479be5721a');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'neighbour01@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aisyah Rahman"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'neighbour02@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tan Wei Jie"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'neighbour03@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Nair"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'neighbour04@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Hafiz Ismail"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'neighbour05@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Wong Mei Ling"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'neighbour06@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Arjun Kumar"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'neighbour07@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Nurul Huda"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'neighbour08@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Daniel Lim"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'neighbour09@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Siti Aminah"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'neighbour10@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Raj Kumaran"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'neighbour11@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Chong Kar Yan"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-00000000000c', 'authenticated', 'authenticated', 'neighbour12@demo.solarkita.my', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Farah Aziz"}'::jsonb, now(), now(), '', '', '', '');

update public.profiles p set township_id = v.township_id
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-000000000007'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-000000000006'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-000000000009'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-00000000000a'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-00000000000b'::uuid, 'elmina'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'bukit-raja'),
  ('a0000000-0000-4000-8000-000000000008'::uuid, 'bukit-raja'),
  ('a0000000-0000-4000-8000-00000000000c'::uuid, 'serenia')
) as v(id, township_id)
where p.id = v.id;

-- any other existing auth users get their profile back
insert into public.profiles (id, full_name)
select u.id, nullif(u.raw_user_meta_data ->> 'full_name', '') from auth.users u
on conflict (id) do nothing;
insert into public.notification_preferences (user_id)
select id from public.profiles on conflict (user_id) do nothing;

-- ----------------------------
-- 6. Subscriptions (199) and units (248)
-- Every unit the app shows as taken is owned by a neighbour; the demo
-- resident owns elmina-subscription #3 and elmina-rooftop #0.
-- ----------------------------
insert into public.subscriptions (id, user_id, site_id, since_month, status, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', '7ea49052-2efb-43a6-9e49-de479be5721a', 'elmina-subscription', '2024-01-01', 'active', '2024-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000002', '7ea49052-2efb-43a6-9e49-de479be5721a', 'elmina-rooftop', '2024-03-01', 'active', '2024-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'elmina-subscription', '2024-01-01', 'active', '2024-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'elmina-subscription', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004', 'elmina-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000005', 'elmina-subscription', '2024-05-01', 'active', '2024-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', 'elmina-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000006', 'elmina-investment', '2024-11-01', 'active', '2024-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000007', 'elmina-investment', '2025-06-01', 'active', '2025-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000009', 'elmina-investment', '2024-01-01', 'active', '2024-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000a', 'elmina-investment', '2024-08-01', 'active', '2024-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-00000000000b', 'elmina-investment', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-000000000001', 'elmina-investment', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-00000000000b', 'elmina-rooftop', '2024-11-01', 'active', '2024-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-000000000001', 'elmina-rooftop', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000004', 'elmina-ev', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000005', 'elmina-ev', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000006', 'elmina-ev', '2025-02-01', 'active', '2025-02-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-00000000000a', 'bukit-raja-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000001', 'bukit-raja-subscription', '2024-05-01', 'active', '2024-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000002', 'bukit-raja-subscription', '2024-12-01', 'active', '2024-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000016', 'a0000000-0000-4000-8000-000000000002', 'bukit-raja-rooftop', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000017', 'a0000000-0000-4000-8000-000000000007', 'bukit-raja-ev', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000018', 'a0000000-0000-4000-8000-000000000008', 'bukit-raja-ev', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000019', 'a0000000-0000-4000-8000-00000000000a', 'bukit-raja-ev', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000001a', 'a0000000-0000-4000-8000-00000000000c', 'serenia-subscription', '2024-01-01', 'active', '2024-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000001b', 'a0000000-0000-4000-8000-000000000001', 'serenia-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000001c', 'a0000000-0000-4000-8000-000000000002', 'serenia-subscription', '2024-03-01', 'active', '2024-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000001d', 'a0000000-0000-4000-8000-000000000003', 'serenia-subscription', '2024-10-01', 'active', '2024-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000001e', 'a0000000-0000-4000-8000-000000000005', 'serenia-subscription', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000001f', 'a0000000-0000-4000-8000-000000000006', 'serenia-subscription', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000005', 'serenia-investment', '2024-01-01', 'active', '2024-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000007', 'serenia-investment', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000009', 'serenia-investment', '2024-03-01', 'active', '2024-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-00000000000b', 'serenia-investment', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000001', 'serenia-investment', '2023-11-01', 'active', '2023-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000025', 'a0000000-0000-4000-8000-00000000000b', 'serenia-rooftop', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000026', 'a0000000-0000-4000-8000-00000000000c', 'serenia-rooftop', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000027', 'a0000000-0000-4000-8000-000000000003', 'ara-subscription', '2024-01-01', 'active', '2024-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000028', 'a0000000-0000-4000-8000-000000000005', 'ara-subscription', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000029', 'a0000000-0000-4000-8000-000000000006', 'ara-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000002a', 'a0000000-0000-4000-8000-000000000008', 'ara-ev', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000002b', 'a0000000-0000-4000-8000-00000000000a', 'ara-ev', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000002c', 'a0000000-0000-4000-8000-000000000001', 'subang-jaya-rooftop', '2024-05-01', 'active', '2024-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000002d', 'a0000000-0000-4000-8000-000000000002', 'subang-jaya-rooftop', '2024-12-01', 'active', '2024-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000002e', 'a0000000-0000-4000-8000-000000000003', 'subang-jaya-rooftop', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000002f', 'a0000000-0000-4000-8000-000000000006', 'subang-jaya-subscription', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000008', 'subang-jaya-subscription', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-00000000000a', 'subang-jaya-subscription', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-00000000000b', 'subang-jaya-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000007', 'subang-jaya-investment', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000008', 'subang-jaya-investment', '2024-05-01', 'active', '2024-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000035', 'a0000000-0000-4000-8000-000000000009', 'subang-jaya-investment', '2024-12-01', 'active', '2024-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000036', 'a0000000-0000-4000-8000-00000000000a', 'subang-jaya-investment', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000037', 'a0000000-0000-4000-8000-00000000000b', 'subang-jaya-investment', '2024-04-01', 'active', '2024-04-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000038', 'a0000000-0000-4000-8000-00000000000c', 'subang-jaya-investment', '2024-11-01', 'active', '2024-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000039', 'a0000000-0000-4000-8000-00000000000a', 'putra-heights-rooftop', '2024-10-01', 'active', '2024-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000003a', 'a0000000-0000-4000-8000-000000000002', 'putra-heights-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000003b', 'a0000000-0000-4000-8000-000000000003', 'putra-heights-subscription', '2024-08-01', 'active', '2024-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000003c', 'a0000000-0000-4000-8000-000000000005', 'putra-heights-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000003d', 'a0000000-0000-4000-8000-000000000008', 'putra-heights-subscription', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000003e', 'a0000000-0000-4000-8000-000000000007', 'putra-heights-ev', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000003f', 'a0000000-0000-4000-8000-000000000009', 'putra-heights-ev', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000040', 'a0000000-0000-4000-8000-00000000000a', 'putra-heights-ev', '2025-06-01', 'active', '2025-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000002', 'putra-heights-investment', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000042', 'a0000000-0000-4000-8000-000000000003', 'putra-heights-investment', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000043', 'a0000000-0000-4000-8000-000000000004', 'putra-heights-investment', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000044', 'a0000000-0000-4000-8000-000000000005', 'putra-heights-investment', '2025-02-01', 'active', '2025-02-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000045', 'a0000000-0000-4000-8000-000000000006', 'putra-heights-investment', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000046', 'a0000000-0000-4000-8000-000000000007', 'putra-heights-investment', '2024-06-01', 'active', '2024-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000047', 'a0000000-0000-4000-8000-000000000008', 'putra-heights-investment', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000048', 'a0000000-0000-4000-8000-000000000005', 'bukit-jelutong-rooftop', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000049', 'a0000000-0000-4000-8000-000000000006', 'bukit-jelutong-rooftop', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000004a', 'a0000000-0000-4000-8000-000000000007', 'bukit-jelutong-rooftop', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000004b', 'a0000000-0000-4000-8000-00000000000a', 'bukit-jelutong-subscription', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000004c', 'a0000000-0000-4000-8000-00000000000b', 'bukit-jelutong-subscription', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000004d', 'a0000000-0000-4000-8000-000000000001', 'bukit-jelutong-subscription', '2025-06-01', 'active', '2025-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000004e', 'a0000000-0000-4000-8000-000000000002', 'bukit-jelutong-subscription', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000004f', 'a0000000-0000-4000-8000-000000000003', 'bukit-jelutong-subscription', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000050', 'a0000000-0000-4000-8000-000000000004', 'bukit-jelutong-subscription', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000051', 'a0000000-0000-4000-8000-000000000006', 'bukit-jelutong-ev', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000052', 'a0000000-0000-4000-8000-000000000008', 'bukit-jelutong-investment', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000053', 'a0000000-0000-4000-8000-000000000009', 'bukit-jelutong-investment', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000054', 'a0000000-0000-4000-8000-00000000000a', 'bukit-jelutong-investment', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000055', 'a0000000-0000-4000-8000-00000000000c', 'bukit-jelutong-investment', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000056', 'a0000000-0000-4000-8000-000000000002', 'bukit-jelutong-investment', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000057', 'a0000000-0000-4000-8000-000000000003', 'bukit-jelutong-investment', '2025-02-01', 'active', '2025-02-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000058', 'a0000000-0000-4000-8000-000000000004', 'bukit-jelutong-investment', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000059', 'a0000000-0000-4000-8000-000000000002', 'denai-alam-rooftop', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000005a', 'a0000000-0000-4000-8000-000000000003', 'denai-alam-rooftop', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000005b', 'a0000000-0000-4000-8000-000000000006', 'denai-alam-subscription', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000005c', 'a0000000-0000-4000-8000-000000000007', 'denai-alam-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000005d', 'a0000000-0000-4000-8000-000000000008', 'denai-alam-subscription', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000005e', 'a0000000-0000-4000-8000-000000000009', 'denai-alam-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000005f', 'a0000000-0000-4000-8000-00000000000a', 'denai-alam-subscription', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000060', 'a0000000-0000-4000-8000-00000000000b', 'denai-alam-subscription', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000061', 'a0000000-0000-4000-8000-00000000000c', 'denai-alam-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000062', 'a0000000-0000-4000-8000-00000000000c', 'denai-alam-ev', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000063', 'a0000000-0000-4000-8000-000000000001', 'denai-alam-ev', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000064', 'a0000000-0000-4000-8000-000000000006', 'denai-alam-investment', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000065', 'a0000000-0000-4000-8000-000000000007', 'denai-alam-investment', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000066', 'a0000000-0000-4000-8000-000000000008', 'denai-alam-investment', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000067', 'a0000000-0000-4000-8000-00000000000a', 'denai-alam-investment', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000068', 'a0000000-0000-4000-8000-00000000000b', 'denai-alam-investment', '2024-06-01', 'active', '2024-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000069', 'a0000000-0000-4000-8000-00000000000a', 'saujana-impian-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000006a', 'a0000000-0000-4000-8000-00000000000b', 'saujana-impian-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000006b', 'a0000000-0000-4000-8000-00000000000c', 'saujana-impian-subscription', '2025-06-01', 'active', '2025-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000006c', 'a0000000-0000-4000-8000-000000000002', 'saujana-impian-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000006d', 'a0000000-0000-4000-8000-000000000003', 'saujana-impian-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000006e', 'a0000000-0000-4000-8000-000000000002', 'saujana-impian-investment', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000006f', 'a0000000-0000-4000-8000-000000000003', 'saujana-impian-investment', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000070', 'a0000000-0000-4000-8000-000000000004', 'saujana-impian-investment', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000071', 'a0000000-0000-4000-8000-000000000005', 'saujana-impian-investment', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000072', 'a0000000-0000-4000-8000-000000000007', 'saujana-impian-investment', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000073', 'a0000000-0000-4000-8000-000000000009', 'saujana-impian-investment', '2025-02-01', 'active', '2025-02-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000074', 'a0000000-0000-4000-8000-00000000000a', 'saujana-impian-investment', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000075', 'a0000000-0000-4000-8000-000000000007', 'saujana-impian-rooftop', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000076', 'a0000000-0000-4000-8000-000000000009', 'saujana-impian-rooftop', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000077', 'a0000000-0000-4000-8000-00000000000c', 'melawati-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000078', 'a0000000-0000-4000-8000-000000000002', 'melawati-subscription', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000079', 'a0000000-0000-4000-8000-000000000006', 'melawati-subscription', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000007a', 'a0000000-0000-4000-8000-000000000005', 'melawati-investment', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000007b', 'a0000000-0000-4000-8000-000000000008', 'melawati-investment', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000007c', 'a0000000-0000-4000-8000-00000000000b', 'melawati-investment', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000007d', 'a0000000-0000-4000-8000-00000000000c', 'melawati-investment', '2025-02-01', 'active', '2025-02-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000007e', 'a0000000-0000-4000-8000-000000000001', 'melawati-investment', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000007f', 'a0000000-0000-4000-8000-00000000000a', 'melawati-rooftop', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000080', 'a0000000-0000-4000-8000-00000000000c', 'melawati-rooftop', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000081', 'a0000000-0000-4000-8000-000000000003', 'klgcc-subscription', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000082', 'a0000000-0000-4000-8000-000000000005', 'klgcc-subscription', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000083', 'a0000000-0000-4000-8000-000000000006', 'klgcc-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000084', 'a0000000-0000-4000-8000-000000000008', 'klgcc-subscription', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000085', 'a0000000-0000-4000-8000-000000000009', 'klgcc-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000086', 'a0000000-0000-4000-8000-000000000009', 'klgcc-investment', '2025-02-01', 'active', '2025-02-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000087', 'a0000000-0000-4000-8000-00000000000c', 'klgcc-investment', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000088', 'a0000000-0000-4000-8000-000000000001', 'klgcc-rooftop', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000089', 'a0000000-0000-4000-8000-000000000003', 'klgcc-rooftop', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000008a', 'a0000000-0000-4000-8000-000000000008', 'nilai-impian-rooftop', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000008b', 'a0000000-0000-4000-8000-00000000000b', 'nilai-impian-subscription', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000008c', 'a0000000-0000-4000-8000-00000000000c', 'nilai-impian-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000008d', 'a0000000-0000-4000-8000-000000000002', 'nilai-impian-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000008e', 'a0000000-0000-4000-8000-000000000003', 'nilai-impian-subscription', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000008f', 'a0000000-0000-4000-8000-000000000004', 'nilai-impian-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000090', 'a0000000-0000-4000-8000-000000000005', 'nilai-impian-subscription', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000091', 'a0000000-0000-4000-8000-000000000004', 'nilai-impian-ev', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000092', 'a0000000-0000-4000-8000-000000000005', 'nilai-impian-ev', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000093', 'a0000000-0000-4000-8000-000000000006', 'nilai-impian-ev', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000094', 'a0000000-0000-4000-8000-000000000007', 'nilai-impian-ev', '2025-04-01', 'active', '2025-04-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000095', 'a0000000-0000-4000-8000-000000000009', 'nilai-impian-investment', '2024-07-01', 'active', '2024-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000096', 'a0000000-0000-4000-8000-00000000000a', 'nilai-impian-investment', '2025-02-01', 'active', '2025-02-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000097', 'a0000000-0000-4000-8000-00000000000b', 'nilai-impian-investment', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000098', 'a0000000-0000-4000-8000-00000000000c', 'nilai-impian-investment', '2024-06-01', 'active', '2024-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-000000000099', 'a0000000-0000-4000-8000-000000000002', 'nilai-impian-investment', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000009a', 'a0000000-0000-4000-8000-000000000003', 'nilai-impian-investment', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000009b', 'a0000000-0000-4000-8000-000000000004', 'nilai-impian-investment', '2025-04-01', 'active', '2025-04-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000009c', 'a0000000-0000-4000-8000-000000000005', 'nilai-impian-investment', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000009d', 'a0000000-0000-4000-8000-000000000002', 'planters-haven-subscription', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000009e', 'a0000000-0000-4000-8000-000000000003', 'planters-haven-subscription', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-00000000009f', 'a0000000-0000-4000-8000-000000000006', 'planters-haven-subscription', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a0', 'a0000000-0000-4000-8000-000000000007', 'planters-haven-subscription', '2024-06-01', 'active', '2024-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-000000000008', 'planters-haven-investment', '2024-08-01', 'active', '2024-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a2', 'a0000000-0000-4000-8000-00000000000a', 'planters-haven-investment', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a3', 'a0000000-0000-4000-8000-00000000000b', 'planters-haven-investment', '2024-11-01', 'active', '2024-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a4', 'a0000000-0000-4000-8000-00000000000c', 'planters-haven-investment', '2025-06-01', 'active', '2025-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a5', 'a0000000-0000-4000-8000-000000000001', 'planters-haven-investment', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a6', 'a0000000-0000-4000-8000-000000000002', 'planters-haven-investment', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a7', 'a0000000-0000-4000-8000-00000000000c', 'planters-haven-rooftop', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a8', 'a0000000-0000-4000-8000-000000000001', 'planters-haven-rooftop', '2024-08-01', 'active', '2024-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000a9', 'a0000000-0000-4000-8000-000000000002', 'planters-haven-rooftop', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000aa', 'a0000000-0000-4000-8000-000000000005', 'ainsdale-rooftop', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000ab', 'a0000000-0000-4000-8000-000000000006', 'ainsdale-rooftop', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000ac', 'a0000000-0000-4000-8000-00000000000b', 'ainsdale-subscription', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000ad', 'a0000000-0000-4000-8000-00000000000c', 'ainsdale-subscription', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000ae', 'a0000000-0000-4000-8000-000000000001', 'ainsdale-subscription', '2025-06-01', 'active', '2025-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000af', 'a0000000-0000-4000-8000-000000000002', 'ainsdale-subscription', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b0', 'a0000000-0000-4000-8000-000000000004', 'ainsdale-subscription', '2025-11-01', 'active', '2025-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b1', 'a0000000-0000-4000-8000-000000000003', 'ainsdale-ev', '2025-09-01', 'active', '2025-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b2', 'a0000000-0000-4000-8000-000000000004', 'ainsdale-ev', '2024-06-01', 'active', '2024-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b3', 'a0000000-0000-4000-8000-00000000000b', 'ainsdale-investment', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b4', 'a0000000-0000-4000-8000-00000000000c', 'ainsdale-investment', '2024-11-01', 'active', '2024-11-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b5', 'a0000000-0000-4000-8000-000000000001', 'ainsdale-investment', '2025-12-01', 'active', '2025-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b6', 'a0000000-0000-4000-8000-000000000002', 'ainsdale-investment', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b7', 'a0000000-0000-4000-8000-000000000004', 'ainsdale-investment', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b8', 'a0000000-0000-4000-8000-000000000003', 'pagoh-rooftop', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000b9', 'a0000000-0000-4000-8000-000000000006', 'pagoh-subscription', '2025-01-01', 'active', '2025-01-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000ba', 'a0000000-0000-4000-8000-000000000007', 'pagoh-subscription', '2025-08-01', 'active', '2025-08-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000bb', 'a0000000-0000-4000-8000-000000000008', 'pagoh-subscription', '2024-09-01', 'active', '2024-09-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000bc', 'a0000000-0000-4000-8000-00000000000b', 'pagoh-subscription', '2024-12-01', 'active', '2024-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000bd', 'a0000000-0000-4000-8000-00000000000b', 'pagoh-ev', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000be', 'a0000000-0000-4000-8000-00000000000c', 'pagoh-ev', '2024-04-01', 'active', '2024-04-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000bf', 'a0000000-0000-4000-8000-000000000001', 'pagoh-ev', '2025-03-01', 'active', '2025-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c0', 'a0000000-0000-4000-8000-000000000002', 'pagoh-ev', '2025-10-01', 'active', '2025-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-000000000005', 'pagoh-investment', '2024-12-01', 'active', '2024-12-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c2', 'a0000000-0000-4000-8000-000000000006', 'pagoh-investment', '2025-07-01', 'active', '2025-07-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c3', 'a0000000-0000-4000-8000-000000000007', 'pagoh-investment', '2024-04-01', 'active', '2024-04-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c4', 'a0000000-0000-4000-8000-000000000009', 'pagoh-investment', '2025-06-01', 'active', '2025-06-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c5', 'a0000000-0000-4000-8000-00000000000a', 'pagoh-investment', '2024-03-01', 'active', '2024-03-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c6', 'a0000000-0000-4000-8000-00000000000b', 'pagoh-investment', '2024-10-01', 'active', '2024-10-01'::timestamptz + interval '2 days'),
  ('b0000000-0000-4000-8000-0000000000c7', 'a0000000-0000-4000-8000-00000000000c', 'pagoh-investment', '2025-05-01', 'active', '2025-05-01'::timestamptz + interval '2 days');

insert into public.subscription_units (subscription_id, site_id, unit_index)
values
  ('b0000000-0000-4000-8000-000000000001', 'elmina-subscription', 3),
  ('b0000000-0000-4000-8000-000000000002', 'elmina-rooftop', 0),
  ('b0000000-0000-4000-8000-000000000003', 'elmina-subscription', 0),
  ('b0000000-0000-4000-8000-000000000003', 'elmina-subscription', 1),
  ('b0000000-0000-4000-8000-000000000004', 'elmina-subscription', 4),
  ('b0000000-0000-4000-8000-000000000004', 'elmina-subscription', 5),
  ('b0000000-0000-4000-8000-000000000005', 'elmina-subscription', 6),
  ('b0000000-0000-4000-8000-000000000006', 'elmina-subscription', 9),
  ('b0000000-0000-4000-8000-000000000007', 'elmina-subscription', 12),
  ('b0000000-0000-4000-8000-000000000008', 'elmina-investment', 0),
  ('b0000000-0000-4000-8000-000000000008', 'elmina-investment', 1),
  ('b0000000-0000-4000-8000-000000000009', 'elmina-investment', 2),
  ('b0000000-0000-4000-8000-000000000009', 'elmina-investment', 3),
  ('b0000000-0000-4000-8000-00000000000a', 'elmina-investment', 6),
  ('b0000000-0000-4000-8000-00000000000a', 'elmina-investment', 7),
  ('b0000000-0000-4000-8000-00000000000b', 'elmina-investment', 8),
  ('b0000000-0000-4000-8000-00000000000c', 'elmina-investment', 10),
  ('b0000000-0000-4000-8000-00000000000d', 'elmina-investment', 14),
  ('b0000000-0000-4000-8000-00000000000e', 'elmina-rooftop', 1),
  ('b0000000-0000-4000-8000-00000000000f', 'elmina-rooftop', 4),
  ('b0000000-0000-4000-8000-000000000010', 'elmina-ev', 0),
  ('b0000000-0000-4000-8000-000000000011', 'elmina-ev', 3),
  ('b0000000-0000-4000-8000-000000000012', 'elmina-ev', 5),
  ('b0000000-0000-4000-8000-000000000013', 'bukit-raja-subscription', 2),
  ('b0000000-0000-4000-8000-000000000013', 'bukit-raja-subscription', 3),
  ('b0000000-0000-4000-8000-000000000014', 'bukit-raja-subscription', 8),
  ('b0000000-0000-4000-8000-000000000015', 'bukit-raja-subscription', 11),
  ('b0000000-0000-4000-8000-000000000016', 'bukit-raja-rooftop', 0),
  ('b0000000-0000-4000-8000-000000000017', 'bukit-raja-ev', 1),
  ('b0000000-0000-4000-8000-000000000018', 'bukit-raja-ev', 2),
  ('b0000000-0000-4000-8000-000000000019', 'bukit-raja-ev', 6),
  ('b0000000-0000-4000-8000-00000000001a', 'serenia-subscription', 0),
  ('b0000000-0000-4000-8000-00000000001b', 'serenia-subscription', 2),
  ('b0000000-0000-4000-8000-00000000001c', 'serenia-subscription', 4),
  ('b0000000-0000-4000-8000-00000000001d', 'serenia-subscription', 7),
  ('b0000000-0000-4000-8000-00000000001e', 'serenia-subscription', 10),
  ('b0000000-0000-4000-8000-00000000001f', 'serenia-subscription', 13),
  ('b0000000-0000-4000-8000-000000000020', 'serenia-investment', 0),
  ('b0000000-0000-4000-8000-000000000020', 'serenia-investment', 1),
  ('b0000000-0000-4000-8000-000000000021', 'serenia-investment', 4),
  ('b0000000-0000-4000-8000-000000000021', 'serenia-investment', 5),
  ('b0000000-0000-4000-8000-000000000022', 'serenia-investment', 9),
  ('b0000000-0000-4000-8000-000000000023', 'serenia-investment', 12),
  ('b0000000-0000-4000-8000-000000000024', 'serenia-investment', 16),
  ('b0000000-0000-4000-8000-000000000024', 'serenia-investment', 17),
  ('b0000000-0000-4000-8000-000000000025', 'serenia-rooftop', 2),
  ('b0000000-0000-4000-8000-000000000025', 'serenia-rooftop', 3),
  ('b0000000-0000-4000-8000-000000000026', 'serenia-rooftop', 5),
  ('b0000000-0000-4000-8000-000000000027', 'ara-subscription', 1),
  ('b0000000-0000-4000-8000-000000000028', 'ara-subscription', 5),
  ('b0000000-0000-4000-8000-000000000029', 'ara-subscription', 6),
  ('b0000000-0000-4000-8000-00000000002a', 'ara-ev', 0),
  ('b0000000-0000-4000-8000-00000000002a', 'ara-ev', 1),
  ('b0000000-0000-4000-8000-00000000002b', 'ara-ev', 4),
  ('b0000000-0000-4000-8000-00000000002c', 'subang-jaya-rooftop', 0),
  ('b0000000-0000-4000-8000-00000000002c', 'subang-jaya-rooftop', 1),
  ('b0000000-0000-4000-8000-00000000002d', 'subang-jaya-rooftop', 3),
  ('b0000000-0000-4000-8000-00000000002e', 'subang-jaya-rooftop', 5),
  ('b0000000-0000-4000-8000-00000000002f', 'subang-jaya-subscription', 0),
  ('b0000000-0000-4000-8000-000000000030', 'subang-jaya-subscription', 5),
  ('b0000000-0000-4000-8000-000000000031', 'subang-jaya-subscription', 8),
  ('b0000000-0000-4000-8000-000000000031', 'subang-jaya-subscription', 9),
  ('b0000000-0000-4000-8000-000000000032', 'subang-jaya-subscription', 11),
  ('b0000000-0000-4000-8000-000000000033', 'subang-jaya-investment', 6),
  ('b0000000-0000-4000-8000-000000000033', 'subang-jaya-investment', 7),
  ('b0000000-0000-4000-8000-000000000034', 'subang-jaya-investment', 8),
  ('b0000000-0000-4000-8000-000000000034', 'subang-jaya-investment', 9),
  ('b0000000-0000-4000-8000-000000000035', 'subang-jaya-investment', 10),
  ('b0000000-0000-4000-8000-000000000036', 'subang-jaya-investment', 12),
  ('b0000000-0000-4000-8000-000000000036', 'subang-jaya-investment', 13),
  ('b0000000-0000-4000-8000-000000000037', 'subang-jaya-investment', 15),
  ('b0000000-0000-4000-8000-000000000038', 'subang-jaya-investment', 17),
  ('b0000000-0000-4000-8000-000000000039', 'putra-heights-rooftop', 3),
  ('b0000000-0000-4000-8000-00000000003a', 'putra-heights-subscription', 0),
  ('b0000000-0000-4000-8000-00000000003b', 'putra-heights-subscription', 2),
  ('b0000000-0000-4000-8000-00000000003c', 'putra-heights-subscription', 6),
  ('b0000000-0000-4000-8000-00000000003c', 'putra-heights-subscription', 7),
  ('b0000000-0000-4000-8000-00000000003d', 'putra-heights-subscription', 12),
  ('b0000000-0000-4000-8000-00000000003e', 'putra-heights-ev', 0),
  ('b0000000-0000-4000-8000-00000000003e', 'putra-heights-ev', 1),
  ('b0000000-0000-4000-8000-00000000003f', 'putra-heights-ev', 4),
  ('b0000000-0000-4000-8000-000000000040', 'putra-heights-ev', 7),
  ('b0000000-0000-4000-8000-000000000041', 'putra-heights-investment', 5),
  ('b0000000-0000-4000-8000-000000000042', 'putra-heights-investment', 6),
  ('b0000000-0000-4000-8000-000000000043', 'putra-heights-investment', 8),
  ('b0000000-0000-4000-8000-000000000043', 'putra-heights-investment', 9),
  ('b0000000-0000-4000-8000-000000000044', 'putra-heights-investment', 11),
  ('b0000000-0000-4000-8000-000000000045', 'putra-heights-investment', 13),
  ('b0000000-0000-4000-8000-000000000046', 'putra-heights-investment', 14),
  ('b0000000-0000-4000-8000-000000000046', 'putra-heights-investment', 15),
  ('b0000000-0000-4000-8000-000000000047', 'putra-heights-investment', 17),
  ('b0000000-0000-4000-8000-000000000048', 'bukit-jelutong-rooftop', 0),
  ('b0000000-0000-4000-8000-000000000048', 'bukit-jelutong-rooftop', 1),
  ('b0000000-0000-4000-8000-000000000049', 'bukit-jelutong-rooftop', 2),
  ('b0000000-0000-4000-8000-000000000049', 'bukit-jelutong-rooftop', 3),
  ('b0000000-0000-4000-8000-00000000004a', 'bukit-jelutong-rooftop', 4),
  ('b0000000-0000-4000-8000-00000000004a', 'bukit-jelutong-rooftop', 5),
  ('b0000000-0000-4000-8000-00000000004b', 'bukit-jelutong-subscription', 0),
  ('b0000000-0000-4000-8000-00000000004c', 'bukit-jelutong-subscription', 2),
  ('b0000000-0000-4000-8000-00000000004d', 'bukit-jelutong-subscription', 6),
  ('b0000000-0000-4000-8000-00000000004e', 'bukit-jelutong-subscription', 8),
  ('b0000000-0000-4000-8000-00000000004f', 'bukit-jelutong-subscription', 11),
  ('b0000000-0000-4000-8000-000000000050', 'bukit-jelutong-subscription', 12),
  ('b0000000-0000-4000-8000-000000000050', 'bukit-jelutong-subscription', 13),
  ('b0000000-0000-4000-8000-000000000051', 'bukit-jelutong-ev', 6),
  ('b0000000-0000-4000-8000-000000000052', 'bukit-jelutong-investment', 1),
  ('b0000000-0000-4000-8000-000000000053', 'bukit-jelutong-investment', 2),
  ('b0000000-0000-4000-8000-000000000054', 'bukit-jelutong-investment', 4),
  ('b0000000-0000-4000-8000-000000000055', 'bukit-jelutong-investment', 8),
  ('b0000000-0000-4000-8000-000000000056', 'bukit-jelutong-investment', 13),
  ('b0000000-0000-4000-8000-000000000057', 'bukit-jelutong-investment', 14),
  ('b0000000-0000-4000-8000-000000000057', 'bukit-jelutong-investment', 15),
  ('b0000000-0000-4000-8000-000000000058', 'bukit-jelutong-investment', 16),
  ('b0000000-0000-4000-8000-000000000059', 'denai-alam-rooftop', 3),
  ('b0000000-0000-4000-8000-00000000005a', 'denai-alam-rooftop', 5),
  ('b0000000-0000-4000-8000-00000000005b', 'denai-alam-subscription', 1),
  ('b0000000-0000-4000-8000-00000000005c', 'denai-alam-subscription', 2),
  ('b0000000-0000-4000-8000-00000000005c', 'denai-alam-subscription', 3),
  ('b0000000-0000-4000-8000-00000000005d', 'denai-alam-subscription', 4),
  ('b0000000-0000-4000-8000-00000000005e', 'denai-alam-subscription', 7),
  ('b0000000-0000-4000-8000-00000000005f', 'denai-alam-subscription', 8),
  ('b0000000-0000-4000-8000-00000000005f', 'denai-alam-subscription', 9),
  ('b0000000-0000-4000-8000-000000000060', 'denai-alam-subscription', 10),
  ('b0000000-0000-4000-8000-000000000060', 'denai-alam-subscription', 11),
  ('b0000000-0000-4000-8000-000000000061', 'denai-alam-subscription', 13),
  ('b0000000-0000-4000-8000-000000000062', 'denai-alam-ev', 2),
  ('b0000000-0000-4000-8000-000000000063', 'denai-alam-ev', 4),
  ('b0000000-0000-4000-8000-000000000063', 'denai-alam-ev', 5),
  ('b0000000-0000-4000-8000-000000000064', 'denai-alam-investment', 4),
  ('b0000000-0000-4000-8000-000000000065', 'denai-alam-investment', 6),
  ('b0000000-0000-4000-8000-000000000066', 'denai-alam-investment', 8),
  ('b0000000-0000-4000-8000-000000000067', 'denai-alam-investment', 12),
  ('b0000000-0000-4000-8000-000000000068', 'denai-alam-investment', 14),
  ('b0000000-0000-4000-8000-000000000068', 'denai-alam-investment', 15),
  ('b0000000-0000-4000-8000-000000000069', 'saujana-impian-subscription', 2),
  ('b0000000-0000-4000-8000-000000000069', 'saujana-impian-subscription', 3),
  ('b0000000-0000-4000-8000-00000000006a', 'saujana-impian-subscription', 4),
  ('b0000000-0000-4000-8000-00000000006b', 'saujana-impian-subscription', 7),
  ('b0000000-0000-4000-8000-00000000006c', 'saujana-impian-subscription', 11),
  ('b0000000-0000-4000-8000-00000000006d', 'saujana-impian-subscription', 13),
  ('b0000000-0000-4000-8000-00000000006e', 'saujana-impian-investment', 1),
  ('b0000000-0000-4000-8000-00000000006f', 'saujana-impian-investment', 3),
  ('b0000000-0000-4000-8000-000000000070', 'saujana-impian-investment', 5),
  ('b0000000-0000-4000-8000-000000000071', 'saujana-impian-investment', 7),
  ('b0000000-0000-4000-8000-000000000072', 'saujana-impian-investment', 10),
  ('b0000000-0000-4000-8000-000000000073', 'saujana-impian-investment', 14),
  ('b0000000-0000-4000-8000-000000000073', 'saujana-impian-investment', 15),
  ('b0000000-0000-4000-8000-000000000074', 'saujana-impian-investment', 16),
  ('b0000000-0000-4000-8000-000000000075', 'saujana-impian-rooftop', 0),
  ('b0000000-0000-4000-8000-000000000076', 'saujana-impian-rooftop', 4),
  ('b0000000-0000-4000-8000-000000000077', 'melawati-subscription', 1),
  ('b0000000-0000-4000-8000-000000000078', 'melawati-subscription', 5),
  ('b0000000-0000-4000-8000-000000000079', 'melawati-subscription', 13),
  ('b0000000-0000-4000-8000-00000000007a', 'melawati-investment', 0),
  ('b0000000-0000-4000-8000-00000000007b', 'melawati-investment', 7),
  ('b0000000-0000-4000-8000-00000000007c', 'melawati-investment', 12),
  ('b0000000-0000-4000-8000-00000000007c', 'melawati-investment', 13),
  ('b0000000-0000-4000-8000-00000000007d', 'melawati-investment', 14),
  ('b0000000-0000-4000-8000-00000000007d', 'melawati-investment', 15),
  ('b0000000-0000-4000-8000-00000000007e', 'melawati-investment', 16),
  ('b0000000-0000-4000-8000-00000000007e', 'melawati-investment', 17),
  ('b0000000-0000-4000-8000-00000000007f', 'melawati-rooftop', 1),
  ('b0000000-0000-4000-8000-000000000080', 'melawati-rooftop', 4),
  ('b0000000-0000-4000-8000-000000000081', 'klgcc-subscription', 0),
  ('b0000000-0000-4000-8000-000000000081', 'klgcc-subscription', 1),
  ('b0000000-0000-4000-8000-000000000082', 'klgcc-subscription', 5),
  ('b0000000-0000-4000-8000-000000000083', 'klgcc-subscription', 7),
  ('b0000000-0000-4000-8000-000000000084', 'klgcc-subscription', 11),
  ('b0000000-0000-4000-8000-000000000085', 'klgcc-subscription', 13),
  ('b0000000-0000-4000-8000-000000000086', 'klgcc-investment', 2),
  ('b0000000-0000-4000-8000-000000000086', 'klgcc-investment', 3),
  ('b0000000-0000-4000-8000-000000000087', 'klgcc-investment', 8),
  ('b0000000-0000-4000-8000-000000000088', 'klgcc-rooftop', 1),
  ('b0000000-0000-4000-8000-000000000089', 'klgcc-rooftop', 4),
  ('b0000000-0000-4000-8000-00000000008a', 'nilai-impian-rooftop', 4),
  ('b0000000-0000-4000-8000-00000000008b', 'nilai-impian-subscription', 1),
  ('b0000000-0000-4000-8000-00000000008c', 'nilai-impian-subscription', 2),
  ('b0000000-0000-4000-8000-00000000008c', 'nilai-impian-subscription', 3),
  ('b0000000-0000-4000-8000-00000000008d', 'nilai-impian-subscription', 7),
  ('b0000000-0000-4000-8000-00000000008e', 'nilai-impian-subscription', 8),
  ('b0000000-0000-4000-8000-00000000008f', 'nilai-impian-subscription', 10),
  ('b0000000-0000-4000-8000-00000000008f', 'nilai-impian-subscription', 11),
  ('b0000000-0000-4000-8000-000000000090', 'nilai-impian-subscription', 12),
  ('b0000000-0000-4000-8000-000000000090', 'nilai-impian-subscription', 13),
  ('b0000000-0000-4000-8000-000000000091', 'nilai-impian-ev', 1),
  ('b0000000-0000-4000-8000-000000000092', 'nilai-impian-ev', 3),
  ('b0000000-0000-4000-8000-000000000093', 'nilai-impian-ev', 5),
  ('b0000000-0000-4000-8000-000000000094', 'nilai-impian-ev', 6),
  ('b0000000-0000-4000-8000-000000000095', 'nilai-impian-investment', 0),
  ('b0000000-0000-4000-8000-000000000096', 'nilai-impian-investment', 3),
  ('b0000000-0000-4000-8000-000000000097', 'nilai-impian-investment', 4),
  ('b0000000-0000-4000-8000-000000000097', 'nilai-impian-investment', 5),
  ('b0000000-0000-4000-8000-000000000098', 'nilai-impian-investment', 6),
  ('b0000000-0000-4000-8000-000000000099', 'nilai-impian-investment', 11),
  ('b0000000-0000-4000-8000-00000000009a', 'nilai-impian-investment', 12),
  ('b0000000-0000-4000-8000-00000000009b', 'nilai-impian-investment', 14),
  ('b0000000-0000-4000-8000-00000000009c', 'nilai-impian-investment', 16),
  ('b0000000-0000-4000-8000-00000000009d', 'planters-haven-subscription', 1),
  ('b0000000-0000-4000-8000-00000000009e', 'planters-haven-subscription', 3),
  ('b0000000-0000-4000-8000-00000000009f', 'planters-haven-subscription', 9),
  ('b0000000-0000-4000-8000-0000000000a0', 'planters-haven-subscription', 11),
  ('b0000000-0000-4000-8000-0000000000a1', 'planters-haven-investment', 3),
  ('b0000000-0000-4000-8000-0000000000a2', 'planters-haven-investment', 6),
  ('b0000000-0000-4000-8000-0000000000a3', 'planters-haven-investment', 8),
  ('b0000000-0000-4000-8000-0000000000a3', 'planters-haven-investment', 9),
  ('b0000000-0000-4000-8000-0000000000a4', 'planters-haven-investment', 10),
  ('b0000000-0000-4000-8000-0000000000a4', 'planters-haven-investment', 11),
  ('b0000000-0000-4000-8000-0000000000a5', 'planters-haven-investment', 13),
  ('b0000000-0000-4000-8000-0000000000a6', 'planters-haven-investment', 15),
  ('b0000000-0000-4000-8000-0000000000a7', 'planters-haven-rooftop', 1),
  ('b0000000-0000-4000-8000-0000000000a8', 'planters-haven-rooftop', 2),
  ('b0000000-0000-4000-8000-0000000000a9', 'planters-haven-rooftop', 4),
  ('b0000000-0000-4000-8000-0000000000aa', 'ainsdale-rooftop', 0),
  ('b0000000-0000-4000-8000-0000000000ab', 'ainsdale-rooftop', 3),
  ('b0000000-0000-4000-8000-0000000000ac', 'ainsdale-subscription', 2),
  ('b0000000-0000-4000-8000-0000000000ac', 'ainsdale-subscription', 3),
  ('b0000000-0000-4000-8000-0000000000ad', 'ainsdale-subscription', 4),
  ('b0000000-0000-4000-8000-0000000000ae', 'ainsdale-subscription', 6),
  ('b0000000-0000-4000-8000-0000000000ae', 'ainsdale-subscription', 7),
  ('b0000000-0000-4000-8000-0000000000af', 'ainsdale-subscription', 8),
  ('b0000000-0000-4000-8000-0000000000af', 'ainsdale-subscription', 9),
  ('b0000000-0000-4000-8000-0000000000b0', 'ainsdale-subscription', 13),
  ('b0000000-0000-4000-8000-0000000000b1', 'ainsdale-ev', 1),
  ('b0000000-0000-4000-8000-0000000000b2', 'ainsdale-ev', 3),
  ('b0000000-0000-4000-8000-0000000000b3', 'ainsdale-investment', 7),
  ('b0000000-0000-4000-8000-0000000000b4', 'ainsdale-investment', 9),
  ('b0000000-0000-4000-8000-0000000000b5', 'ainsdale-investment', 10),
  ('b0000000-0000-4000-8000-0000000000b5', 'ainsdale-investment', 11),
  ('b0000000-0000-4000-8000-0000000000b6', 'ainsdale-investment', 13),
  ('b0000000-0000-4000-8000-0000000000b7', 'ainsdale-investment', 16),
  ('b0000000-0000-4000-8000-0000000000b8', 'pagoh-rooftop', 5),
  ('b0000000-0000-4000-8000-0000000000b9', 'pagoh-subscription', 0),
  ('b0000000-0000-4000-8000-0000000000ba', 'pagoh-subscription', 3),
  ('b0000000-0000-4000-8000-0000000000bb', 'pagoh-subscription', 4),
  ('b0000000-0000-4000-8000-0000000000bb', 'pagoh-subscription', 5),
  ('b0000000-0000-4000-8000-0000000000bc', 'pagoh-subscription', 10),
  ('b0000000-0000-4000-8000-0000000000bd', 'pagoh-ev', 1),
  ('b0000000-0000-4000-8000-0000000000be', 'pagoh-ev', 2),
  ('b0000000-0000-4000-8000-0000000000bf', 'pagoh-ev', 4),
  ('b0000000-0000-4000-8000-0000000000bf', 'pagoh-ev', 5),
  ('b0000000-0000-4000-8000-0000000000c0', 'pagoh-ev', 7),
  ('b0000000-0000-4000-8000-0000000000c1', 'pagoh-investment', 3),
  ('b0000000-0000-4000-8000-0000000000c2', 'pagoh-investment', 4),
  ('b0000000-0000-4000-8000-0000000000c3', 'pagoh-investment', 7),
  ('b0000000-0000-4000-8000-0000000000c4', 'pagoh-investment', 11),
  ('b0000000-0000-4000-8000-0000000000c5', 'pagoh-investment', 13),
  ('b0000000-0000-4000-8000-0000000000c6', 'pagoh-investment', 14),
  ('b0000000-0000-4000-8000-0000000000c7', 'pagoh-investment', 16);

-- ----------------------------
-- 7. Money: one completed contribution per subscription (units x price),
-- monthly Energy Savings Credits from the subscription month to last month
-- (same formula as the app: units x price x mid-return / 12 x sunshine),
-- and this month's credit pending on the 28th.
-- ----------------------------
insert into public.contributions
  (user_id, site_id, subscription_id, amount, status, external_reference, contributed_at, settled_at)
select s.user_id, s.site_id, s.id, u.n * si.price_per_unit, 'completed',
       'SK-CON-' || s.id, s.since_month + interval '1 day 10 hours', s.since_month + interval '2 days 10 hours'
from public.subscriptions s
join public.sites si on si.id = s.site_id
join (select subscription_id, count(*) as n from public.subscription_units group by 1) u on u.subscription_id = s.id;

with sunshine(m, f) as (
  select * from unnest(array[1,2,3,4,5,6,7,8,9,10,11,12],
                       array[0.92,1.02,1.08,1.06,1.0,0.97,1.01,0.99,0.95,0.9,0.86,0.88]::numeric[])
),
holding as (
  select s.id, s.user_id, s.site_id, s.since_month, u.n * si.price_per_unit * (si.return_low_pct + si.return_high_pct) / 200 / 12 as base
  from public.subscriptions s
  join public.sites si on si.id = s.site_id
  join (select subscription_id, count(*) as n from public.subscription_units group by 1) u on u.subscription_id = s.id
)
insert into public.payouts (user_id, site_id, subscription_id, amount, status, due_at, paid_at, external_reference)
select h.user_id, h.site_id, h.id,
       round(h.base * sun.f, 2),
       case when m.month < date_trunc('month', now()) then 'completed' else 'pending' end::public.payout_status,
       m.month + interval '27 days 10 hours',
       case when m.month < date_trunc('month', now()) then m.month + interval '27 days 10 hours' end,
       'SK-PAY-' || h.id || '-' || to_char(m.month, 'YYYYMM')
from holding h
cross join lateral generate_series(h.since_month::timestamptz, date_trunc('month', now()), interval '1 month') as m(month)
join sunshine sun on sun.m = extract(month from m.month);

-- the demo rooftop credit three months ago was paid 2 days late (see alerts)
update public.payouts set paid_at = due_at + interval '2 days'
where subscription_id = 'b0000000-0000-4000-8000-000000000002' and due_at = date_trunc('month', now()) - interval '3 months' + interval '27 days 10 hours';

-- ----------------------------
-- 8. Points: every subscription earns points_per_unit x units; the demo
-- resident also has the activity the app shows (bonuses, event, quiz,
-- EV credit redemption). Balance 1,250 = 2,050 earned - 800 redeemed.
-- ----------------------------
insert into public.point_ledger (user_id, activity, title, points_delta, idempotency_key, metadata, created_at)
select s.user_id, 'subscribe', 'Subscribed to ' || si.name, si.points_per_unit * u.n,
       'seed:subscribe:' || s.id, jsonb_build_object('site_id', s.site_id, 'units', u.n), s.created_at
from public.subscriptions s
join public.sites si on si.id = s.site_id
join (select subscription_id, count(*) as n from public.subscription_units group by 1) u on u.subscription_id = s.id;

insert into public.point_ledger (user_id, activity, title, points_delta, idempotency_key, metadata, created_at)
values
  ('7ea49052-2efb-43a6-9e49-de479be5721a', 'bonus', 'Welcome bonus', 80, 'seed:demo:welcome', '{}', '2024-01-03 10:00+08'),
  ('7ea49052-2efb-43a6-9e49-de479be5721a', 'quiz', 'Energy-saving quiz', 50, 'seed:demo:quiz', '{}', now() - interval '15 days'),
  ('7ea49052-2efb-43a6-9e49-de479be5721a', 'redeem', 'Redeemed EV Charging Credit', -800, 'seed:demo:redeem-ev20', '{"reward_id":"ev20"}', now() - interval '12 days'),
  ('7ea49052-2efb-43a6-9e49-de479be5721a', 'event', 'Joined “Lights Out Hour”', 120, 'seed:demo:lights-out', '{}', now() - interval '6 days');

-- 30 monthly solar bonuses, the latest 2 days ago
insert into public.point_ledger (user_id, activity, title, points_delta, idempotency_key, metadata, created_at)
select '7ea49052-2efb-43a6-9e49-de479be5721a', 'bonus', 'Monthly solar bonus', 50, 'seed:demo:monthly-' || k, '{}', now() - interval '2 days' - make_interval(months => k)
from generate_series(0, 29) as k;

insert into public.redemptions (user_id, reward_id, points_spent, redemption_code, status, redeemed_at)
values ('7ea49052-2efb-43a6-9e49-de479be5721a', 'ev20', 800, 'SK-EV-4821', 'issued', now() - interval '12 days');

update public.profiles p
set points_balance = l.balance, points_lifetime = l.lifetime
from (
  select user_id, sum(points_delta) as balance, sum(greatest(points_delta, 0)) as lifetime
  from public.point_ledger group by user_id
) l
where p.id = l.user_id;

-- ----------------------------
-- 9. Simulated daily generation for the last 365 days (every site).
-- Serenia Sunrise Farm runs 12% under forecast for the last 3 days and
-- Elmina Hub Chargers lost ~4 hours about 29 days ago, matching the alerts.
-- ----------------------------
with sunshine(m, f) as (
  select * from unnest(array[1,2,3,4,5,6,7,8,9,10,11,12],
                       array[0.92,1.02,1.08,1.06,1.0,0.97,1.01,0.99,0.95,0.9,0.86,0.88]::numeric[])
)
insert into public.solar_readings (site_id, measured_at, generation_kwh, expected_kwh, source)
select si.id, d.day + interval '12 hours',
       round(x.expected * case
         when si.id = 'serenia-subscription' and d.day >= date_trunc('day', now()) - interval '3 days' then 0.88
         when si.id = 'elmina-ev' and d.day = date_trunc('day', now() - interval '700 hours') then 0.6
         else 0.9 + 0.18 * (((hashtext(si.id || d.day::text)::bigint % 1000) + 1000) % 1000 / 1000.0)
       end, 4),
       round(x.expected, 4),
       'simulated'
from public.sites si
cross join generate_series(date_trunc('day', now()) - interval '365 days', date_trunc('day', now()) - interval '1 day', interval '1 day') as d(day)
join sunshine sun on sun.m = extract(month from d.day)
cross join lateral (select si.capacity_mw * 1000 * 4.2 * sun.f as expected) x;

-- ----------------------------
-- 10. Alerts for the demo resident (the 8 sample notifications, with
-- amounts/months taken from the rows above). 1-3 unread, 4-8 read.
-- ----------------------------
insert into public.alert_incidents (id, site_id, incident_key, alert_type, severity, title, body, status, first_detected_at, last_detected_at, resolved_at)
values
  ('d0000000-0000-4000-8000-000000000001', 'serenia-subscription', 'low_generation:serenia-subscription:' || to_char(now(), 'YYYY-MM-DD'), 'low_generation', 'warning',
   'Low solar generation', 'Serenia Sunrise Farm 12% below forecast for 3 days', 'open', now() - interval '3 days', now() - interval '90 minutes', null),
  ('d0000000-0000-4000-8000-000000000002', 'elmina-rooftop', 'payout_overdue:elmina-rooftop:' || to_char(date_trunc('month', now()) - interval '3 months', 'YYYY-MM'), 'payout_overdue', 'critical',
   'Credit delayed', 'Rooftop credit paid 2 days late', 'resolved', now() - interval '400 hours' - interval '2 days', now() - interval '400 hours', now() - interval '400 hours'),
  ('d0000000-0000-4000-8000-000000000003', 'elmina-ev', 'project_outage:elmina-ev:' || to_char(now() - interval '700 hours', 'YYYY-MM-DD'), 'project_outage', 'critical',
   'Project outage', 'Inverter maintenance, 4 hours offline', 'resolved', now() - interval '700 hours' - interval '4 hours', now() - interval '700 hours', now() - interval '700 hours');

insert into public.alerts (id, user_id, incident_id, type, severity, title, body, site_id, detection, created_at)
select 'c0000000-0000-4000-8000-000000000001'::uuid, '7ea49052-2efb-43a6-9e49-de479be5721a'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'low_generation'::public.alert_type, 'warning'::public.alert_severity, 'Low solar generation',
       'Serenia Sunrise Farm has been 12% below forecast for 3 days due to heavy cloud cover.', 'serenia-subscription', 'scheduled_check'::public.detection_type, now() - interval '90 minutes'
union all
select 'c0000000-0000-4000-8000-000000000002', '7ea49052-2efb-43a6-9e49-de479be5721a', null, 'payout_completed', 'success', 'Energy Savings Credit applied',
       format('Your %s credit of RM %s was applied to your TNB bill (account ••4821).',
              to_char(date_trunc('month', now()) - interval '1 month', 'FMMonth'),
              to_char((select sum(amount) from public.payouts where user_id = '7ea49052-2efb-43a6-9e49-de479be5721a' and due_at >= date_trunc('month', now()) - interval '1 month' and due_at < date_trunc('month', now())), 'FM999,990.00')),
       null, 'database_event', now() - interval '26 hours'
union all
select 'c0000000-0000-4000-8000-000000000003', '7ea49052-2efb-43a6-9e49-de479be5721a', null, 'funding_milestone', 'info', 'Funding milestone',
       'Elmina Grid Array is 50% funded (9 of 18 array blocks). Subscriptions close in 14 days.', 'elmina-investment', 'scheduled_check', now() - interval '50 hours'
union all
select 'c0000000-0000-4000-8000-000000000004', '7ea49052-2efb-43a6-9e49-de479be5721a', null, 'project_report', 'info', 'New project report',
       format('The %s generation report for Elmina Sunfield is now available.', to_char(date_trunc('month', now()) - interval '1 month', 'FMMonth')),
       'elmina-subscription', 'database_event', now() - interval '74 hours'
union all
select 'c0000000-0000-4000-8000-000000000005', '7ea49052-2efb-43a6-9e49-de479be5721a', null, 'rewards_milestone', 'success', 'Rewards milestone',
       'You passed 2,000 lifetime points and unlocked Level 3 · Solar Champion.', null, 'database_event', now() - interval '120 hours'
union all
select 'c0000000-0000-4000-8000-000000000006', '7ea49052-2efb-43a6-9e49-de479be5721a', null, 'contribution_recorded', 'success', 'Contribution recorded',
       'Your RM 8,000 contribution to Elmina West Homes has been verified.', 'elmina-rooftop', 'database_event', now() - interval '220 hours'
union all
select 'c0000000-0000-4000-8000-000000000007', '7ea49052-2efb-43a6-9e49-de479be5721a', 'd0000000-0000-4000-8000-000000000002', 'payout_overdue', 'critical', 'Credit delayed (resolved)',
       format('The %s credit for Elmina West Homes was 2 days late and has since been applied.', to_char(date_trunc('month', now()) - interval '3 months', 'FMMonth')),
       null, 'scheduled_check', now() - interval '400 hours'
union all
select 'c0000000-0000-4000-8000-000000000008', '7ea49052-2efb-43a6-9e49-de479be5721a', 'd0000000-0000-4000-8000-000000000003', 'project_outage', 'critical', 'Project outage (resolved)',
       'Elmina Hub Chargers were offline for 4 hours for inverter maintenance.', 'elmina-ev', 'monitoring_rule', now() - interval '700 hours';

insert into public.alert_reads (alert_id, user_id, read_at)
select id, user_id, created_at + interval '1 hour' from public.alerts
where id in ('c0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000008');

insert into public.notification_deliveries (alert_id, channel, status, attempts, sent_at)
select id, 'in_app', 'sent', 1, created_at from public.alerts;

-- ----------------------------
-- 11. Assistant chat (empty; the app adds a demo exchange on first open)
-- ----------------------------
insert into public.conversations (id, user_id, title) values ('7ba6c6f8-6d02-47d3-ac22-30d374f632fb', '7ea49052-2efb-43a6-9e49-de479be5721a', 'Demo Chat');

commit;

-- ----------------------------
-- 12. Checks (each should return no rows)
-- ----------------------------
-- units over capacity
select s.id, s.total_units, count(u.*) as held
from public.sites s left join public.subscription_units u on u.site_id = s.id
group by s.id, s.total_units having count(u.*) > s.total_units;

-- profile points that don't match the ledger
select p.id from public.profiles p
left join (select user_id, sum(points_delta) b, sum(greatest(points_delta,0)) l from public.point_ledger group by 1) x on x.user_id = p.id
where p.points_balance <> coalesce(x.b, 0) or p.points_lifetime <> coalesce(x.l, 0);

-- subscriptions without a matching contribution
select s.id from public.subscriptions s
left join public.contributions c on c.subscription_id = s.id
where c.id is null;
