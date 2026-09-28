-- One-off import: 83 businesses with no website found, from a cold-outreach
-- list (categories: gyms, salons, restaurants, photography studios, etc.,
-- across various Indian cities). Lead source "Cold Outreach", assigned to
-- Tanmay (cmuasw8h9000vq5iwnpt9wjm5), status "NEW" (uncontacted). Phone
-- numbers in the sheet are unverified ("Website Status: Verify before
-- calling"), so that's noted on each lead too.
--
-- Run INTERACTIVELY (not piped with -f/<) so you can review the rows it's
-- about to insert before committing:
--   docker compose exec postgres psql -U crm -d crm
-- Paste everything below down to (not including) the final comment, check
-- the rows it prints, then type COMMIT; or ROLLBACK; yourself.
--
-- Duplicate-safe: skips any row whose phone (normalized to its last 10
-- digits) already exists in the Lead table -- same rule the app itself uses.

BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Heavenly Muscle Gym', 'Sudhakar', '+919000884142', 'Gym, Hyderabad. From cold-outreach no-website list; verify number before calling.'),
    ('Grace Beauty & Hair', 'Mamta Sharma', '+917568834567', 'Salon, Jaipur. From cold-outreach no-website list; verify number before calling.'),
    ('P2 Click', 'Prakash Kalaiselvam', '+919940141616', 'Photography, Chennai. From cold-outreach no-website list; verify number before calling.'),
    ('My Dreams Studio', 'Krishna Kumar', '+919840278782', 'Wedding Photography, Chennai. From cold-outreach no-website list; verify number before calling.'),
    ('Galaxy The Gym', 'Shahzad Siddiqui', '+919873712786', 'Gym, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('Club 4 Gym', 'Prateek', '+919717669922', 'Gym, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('TIARA Makeup & Salon', 'Ritu Gupta', '+919721664466', 'Salon, Lucknow. From cold-outreach no-website list; verify number before calling.'),
    ('Fab Future Interior', 'Deepa Advani', '+919909328059', 'Interior, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Harsha Salon & Beauty Spa', 'Adil', '+917039009292', 'Salon, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Lovely Hair Dressing Hall', 'Tahir Shaikh', '+912226354290', 'Salon, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Memsahib Herbal Parlour', 'Mala Tekary', '+919810226363', 'Salon/Spa, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('Palasia Salon & Academy', 'Ruchita', '+912226851115', 'Salon, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Hairways Unisex Salon', 'Kamar Salmani', '+919930545695', 'Salon, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Feliz Salon', 'Shweta Chavan', '+919167361908', 'Salon, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Al-Saba Hair Art', 'Rashid Amin', '+919833475510', 'Salon, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Gymfinity Gym & Fitness Studio', 'Rekha', '+919967367000', 'Gym, Lucknow. From cold-outreach no-website list; verify number before calling.'),
    ('Perfection Salon', 'Priya Prakash', '+919974892707', 'Salon, Surat. From cold-outreach no-website list; verify number before calling.'),
    ('Rama''s Gym', 'Vipul Patel', '+919714174650', 'Gym, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Songar''s Gym', 'Manthan Songar', '+919909650580', 'Gym, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Muscle Nation Gym & Boxing', 'Dinesh Kumar', '+919884689022', 'Gym, Chennai. From cold-outreach no-website list; verify number before calling.'),
    ('Fitness First', 'Srinivasan', '+919566079794', 'Gym, Chennai. From cold-outreach no-website list; verify number before calling.'),
    ('Uppbeat Salon', 'Nimisha Aggarwal', '+919922940770', 'Salon, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('Anand Park Family Saloon & Spa', 'Anand', '+919940434188', 'Salon/Spa, Chennai. From cold-outreach no-website list; verify number before calling.'),
    ('Sania''s Fashion World', 'Aman G.', '+918334070264', 'Salon, Kolkata. From cold-outreach no-website list; verify number before calling.'),
    ('Platinum Health & Fitness Club', 'Rakshit More', '+912025294299', 'Gym, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('Aruna Studio', 'Satish Limmana', '+919949815656', 'Photography/Event, Hyderabad. From cold-outreach no-website list; verify number before calling.'),
    ('Shakti Sangha Gym', 'Biswajit Saha', '+917003798676', 'Gym, Kolkata. From cold-outreach no-website list; verify number before calling.'),
    ('JGS Fitness Centre', 'Shalini Bharghava', '+919324246680', 'Gym, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Health Wealth Gym', 'Kajal Paul', '+919674180749', 'Gym, Kolkata. From cold-outreach no-website list; verify number before calling.'),
    ('RC Events India Pvt. Ltd.', 'Vikas', '+917926462186', 'Events, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Subhamm Digital', 'Sanjay Sharma', '+919811007840', 'Photography/Camera, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('Nakalang Events', 'Bhupesh Prajapati', '+919426063544', 'Events, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Atulya Patwardhan Architects', 'Atulya Patwardhan', '+912064004323', 'Architecture/Interior, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('XL-Strength Training Studio', 'Jivesh Shetty', '+919167882187', 'Gym, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Milonelion Interior Design', 'Haridas Nerkar', '+919420786600', 'Interior, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('Pep Fitness', 'Bikash Mandal', '+913340014087', 'Gym, Kolkata. From cold-outreach no-website list; verify number before calling.'),
    ('Bhushan Chakote Architect & Interior', 'Bhushan Chakote', '+912025440651', 'Interior, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('HD Studio', 'Virendra Vasava', '+917600318965', 'Photography, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Nawab Interior Decorators', 'Deepak Gill', '+919873332303', 'Interior, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('GMB Caterers', 'Vikas Sharma', '+919328134533', 'Catering, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('RK Caterers', 'Yusuf Khan', '+919764837305', 'Catering, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('Kaizad Patel Caterers', 'Kaizad Patel', '+919820200133', 'Catering, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Krishna Tulsi Caterers', 'Esha Sidhu', '+919833019406', 'Catering, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Hindustan Caterer', 'Zaheer', '+917860269492', 'Catering, Lucknow. From cold-outreach no-website list; verify number before calling.'),
    ('Shree Vandana Caterers', 'Lalit Solanki', '+919322305834', 'Catering/Event, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Choudhary Car Decors & Car Wash', 'Bablu Pandey', '+917666686612', 'Car Wash/Detailing, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Sai Chakra Caterers', 'Harish Shetty', '+919833257680', 'Catering, Navi Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Pandhi Decorators', 'Ravinder Singh', '+911124603247', 'Decorators/Catering, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('Rock''s Health & Fitness Centre', 'Praveen Kumar', '+918056961313', 'Gym, Coimbatore. From cold-outreach no-website list; verify number before calling.'),
    ('Panchsheel Hair Dresser & Beauty Parlour', 'Viral Parekh', '+919428880502', 'Salon, Vadodara. From cold-outreach no-website list; verify number before calling.'),
    ('Pristine Unisex Salon', 'Preeti Syal', '+919780022402', 'Salon, Zirakpur. From cold-outreach no-website list; verify number before calling.'),
    ('Body Flex Gym', 'Khan', '+917307120786', 'Gym, Mohali. From cold-outreach no-website list; verify number before calling.'),
    ('Kiran Tambat Photography', 'Kiran Arunbhai Tambat', '+919823021831', 'Photography, Nashik. From cold-outreach no-website list; verify number before calling.'),
    ('Agrasen Architects', 'Sarang Agrawal', '+919403555001', 'Architecture/Interior, Nagpur. From cold-outreach no-website list; verify number before calling.'),
    ('Ruhi Designs', 'Ruhi Amaliyar', '+919879410309', 'Interior, Vadodara. From cold-outreach no-website list; verify number before calling.'),
    ('Baker''s Castle, Arera Colony', 'Bhavdeep Saluja', '+919669001788', 'Bakery/Cafe, Bhopal. From cold-outreach no-website list; verify number before calling.'),
    ('Reddy''s Gokul Brindavan Restaurant', 'Prasanna Reddy', '+917122543007', 'Restaurant, Nagpur. From cold-outreach no-website list; verify number before calling.'),
    ('Four Food', 'V. C. Thomas', '+919327029369', 'Restaurant, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Sasuraal Restaurant', 'Gagan Chawla', '+919899456441', 'Restaurant/Cafe, Gurgaon. From cold-outreach no-website list; verify number before calling.'),
    ('Rathi Palace Family Restaurant', 'Raju', '+912228599998', 'Restaurant, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Panini Cafe', 'Abhijeet Singh', '+917987497583', 'Cafe, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('Eat & Repeat Restaurant', 'Bharat Jodha', '+917727977755', 'Restaurant/Cafe, Jaipur. From cold-outreach no-website list; verify number before calling.'),
    ('Qureshi Kebab Corner', 'Bhupendra Singh', '+919650048222', 'Restaurant, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('Jai Gurudev Restaurant', 'Naresh', '+912652795895', 'Restaurant, Vadodara. From cold-outreach no-website list; verify number before calling.'),
    ('Badri''s Restaurant', 'Sachin Bhattarai', '+918108666449', 'Restaurant, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Fireside Sky Lounge', 'Shrawan Singh', '+919807352622', 'Restaurant/Cafe, Lucknow. From cold-outreach no-website list; verify number before calling.'),
    ('Bharat Chicken Inn', 'Iqbal Ahmed', '+919891289786', 'Restaurant, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('Aljawahar Chicken Corner', 'Nasir Aljawahar', '+919313414386', 'Restaurant, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('The Hudson Cafe', 'Sanjay', '+911147021733', 'Cafe, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('Dr Prabhu Dental Studio', 'Lavanya Prabhu', '+919790718279', 'Dental Clinic, Chennai. From cold-outreach no-website list; verify number before calling.'),
    ('Beauty Bells', 'Mishi Singh', '+919711181911', 'Salon/Spa, Delhi. From cold-outreach no-website list; verify number before calling.'),
    ('MSquare Spa', 'Manoj', '+918056177700', 'Spa, Chennai. From cold-outreach no-website list; verify number before calling.'),
    ('Tag Brothers & Tattoo Parlour', 'Govind Raghunath Vibhar', '+917350964368', 'Salon/Tattoo, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Manali Beauty Spa', 'Hema Batwal', '+919819579390', 'Beauty/Spa, Navi Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('India Photo Studio', 'Vimal Thakar', '+912224112393', 'Photography, Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Sonali Academy of Fine Arts', 'Sonali Achar Ji', '+917995666789', 'Arts Academy, Hyderabad. From cold-outreach no-website list; verify number before calling.'),
    ('Vijetha Study Circle', 'V. J. Reddy', '+919908470999', 'Coaching, Hyderabad. From cold-outreach no-website list; verify number before calling.'),
    ('Anahat Sangeet Academy', 'Ravindra Ghangurde', '+919822097253', 'Music School, Pune. From cold-outreach no-website list; verify number before calling.'),
    ('New Garden Studio', 'Bhadrak Shah', '+918866515728', 'Photography, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Click Art Photo Studio', 'Kishor Bhai', '+919825931125', 'Photography, Surat. From cold-outreach no-website list; verify number before calling.'),
    ('Studio OM', 'Paras Joshi', '+919925367535', 'Photography, Ahmedabad. From cold-outreach no-website list; verify number before calling.'),
    ('Millennium Jumbo', 'Prabhu Prajapati', '+919833667459', 'Printing/Photography, Navi Mumbai. From cold-outreach no-website list; verify number before calling.'),
    ('Musomagic', 'Ashis Naskar', '+917715012370', 'Music/Recording, Navi Mumbai. From cold-outreach no-website list; verify number before calling.')
),
inserted_leads AS (
  INSERT INTO "Lead" (id, name, "contactName", phone, source, status, "assignedToId", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, s.name, s."contactName", s.phone, 'Cold Outreach', 'NEW', 'cmuasw8h9000vq5iwnpt9wjm5', now(), now()
  FROM source s
  WHERE NOT EXISTS (
    SELECT 1 FROM "Lead" l
    WHERE l.phone IS NOT NULL
      AND right(regexp_replace(l.phone, '\D', '', 'g'), 10)
        = right(regexp_replace(s.phone, '\D', '', 'g'), 10)
  )
  RETURNING id, phone
),
inserted_activities AS (
  INSERT INTO "Activity" (id, "leadId", "userId", type, note, "createdAt")
  SELECT gen_random_uuid()::text, il.id, 'cmuasw8h9000vq5iwnpt9wjm5', 'NOTE', s.note, now()
  FROM inserted_leads il
  JOIN source s
    ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
     = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
  RETURNING "leadId"
)
SELECT il.id AS lead_id, s.name, s.phone
FROM inserted_leads il
JOIN source s
  ON right(regexp_replace(s.phone, '\D', '', 'g'), 10)
   = right(regexp_replace(il.phone, '\D', '', 'g'), 10)
ORDER BY s.name;

-- Review the rows printed above -- should be up to 83 (fewer if any
-- numbers already exist in the CRM some other way). If it looks right:
--   COMMIT;
-- Otherwise:
--   ROLLBACK;
