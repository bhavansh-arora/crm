BEGIN;

INSERT INTO "LeadSource" (id, name, active, "createdAt")
VALUES (gen_random_uuid()::text, 'Cold Outreach', true, now())
ON CONFLICT (name) DO NOTHING;

WITH source (name, "contactName", phone, note) AS (
  VALUES
    ('Dreamz Event Management', 'Makarand Tayade', '+919850589110', 'Events/Wedding, Nashik.'),
    ('Fitness Art', 'Sunil Shinde', '+918422996655', 'Gym, Mumbai.'),
    ('Julian''s Gym', 'Barses D. Souza', '+912228821110', 'Gym, Mumbai.'),
    ('S R Gym', 'Jignesh', '+919584786340', 'Gym, Surat.'),
    ('Nilesh Ahire Photography', 'Nilesh Ahire', '+919987403143', 'Photography, Mumbai.'),
    ('Akash Photography', 'Akash Reddy', '+919703143335', 'Photography, Hyderabad.'),
    ('HKS Productions', 'Harkirat Singh', '+918588005404', 'Photography, Delhi.'),
    ('P.K. Digital Studio', 'Parveen Sharma', '+919810141052', 'Photography, Delhi.'),
    ('Optical Shades', 'Rahul Sharma', '+918145960001', 'Photography, Kolkata.'),
    ('Him Studio', 'Sonu Kapoor', '+919899725033', 'Wedding Photography, Delhi.'),
    ('Sura Academy', 'Ramesh', '+919731355030', 'Education, Bangalore.'),
    ('Sanskriti Academy', 'Alok Sharan', '+919431422040', 'Education, Patna.'),
    ('Academy Of Languages', 'Vidhu Taneja', '+919041111335', 'Coaching / Language School, Jalandhar.'),
    ('Natya Kala Nivas', 'Unnath Jain', '+919964695381', 'Dance School, Hassan.'),
    ('Bhairavi Design & Skill Academy', 'S. Siva', '+919940434996', 'Design Academy, Hosur.'),
    ('Heaven Gymnastic Academy', 'Harshad Kulkarni', '+917620518404', 'Gymnastics/Fitness, Pimpri-Chinchwad.'),
    ('Kaizad Patel Caterers', 'Kaizad Patel', '+919820200133', 'Catering, Mumbai.'),
    ('Preet Caterers', 'Ishan Gandhi', '+919925312371', 'Catering, Vadodara.'),
    ('Natu Caterers', 'Vaibhav Natu', '+919860595903', 'Catering, Nashik.'),
    ('Date Caterers', 'Heramb', '+919922991757', 'Catering, Dhule.'),
    ('Prayog Design Studio', 'Yogesh Gandevikar', '+919824425700', 'Event/Wedding/Design, Ahmedabad.'),
    ('Workout Wonders', 'Joginder Singh', '+919990768116', 'Gym, Delhi.'),
    ('Compact Digital Wedding Studio', 'Syed', '+919986771099', 'Wedding Photography, Bangalore.'),
    ('Gym Planet', 'Waseem Khan', '+912406611077', 'Gym, Aurangabad.'),
    ('KALA – A Piece of Art', 'Meenu Goyal', '+919850899047', 'Interior Design, Pune.'),
    ('A&I Digest, Amit Danait', 'Amit Danait', '+919604789789', 'Interior Design, Pune.'),
    ('AM Interior', 'Manoj Ghode', '+918767116163', 'Interior Design, Pune.'),
    ('Sumit Photography', 'Sumit', '+918561852373', 'Photography, Jaipur.'),
    ('King Scissor Men''s Parlour', 'Faisal Shaikh', '+919890991259', 'Salon, Pune.'),
    ('Lotus Event Management', 'Raj Bhatt', '+919825222139', 'Event Management, Ahmedabad.'),
    ('Parth Party Plot', 'Jignesh Patel', '+919898818283', 'Event Venue, Ahmedabad.'),
    ('Rehoboth Photography', 'Atul Cecil', '+919824333131', 'Wedding Photography, Ahmedabad.'),
    ('Jeevan G-one Photography', 'Jay Shankar', '+917899988557', 'Photography, Bangalore.'),
    ('Bless Photography', 'Chetan Suvarna', '+918904047099', 'Wedding Photography, Bangalore.'),
    ('WHITE WINDOOR Entertainment Networks', 'Ramesh Kurmapu', '+919948215009', 'Events/Advertising, Visakhapatnam.'),
    ('Diya Interiors', 'Arun Sharma', '+918197962437', 'Interior Design, Bangalore.'),
    ('Ganpati Events Management', 'Sandeep Gupta', '+919829299052', 'Event Management, Jaipur.'),
    ('Nritya Studio', 'Akriti Grover', '+919769712642', 'Dance/Event Management, Navi Mumbai.'),
    ('Fusion Beat Events', 'Khushwant', '+919922600000', 'Event Management, Nagpur.'),
    ('Studio OM', 'Paras Joshi', '+919925367535', 'Photography, Ahmedabad.'),
    ('Rajoriya''s Photo Studio', 'Rajoria N. L.', '+919829010983', 'Wedding Photography, Jaipur.'),
    ('Yashwant Sawant & Associates', 'Yashwant Sawant', '+919822247521', 'Interior Design, Pune.'),
    ('HA Event Management', 'Unknown', '+918885280076', 'Event Management, Hyderabad.'),
    ('Sri Media Event & Wedding Planner', 'Unknown', '+919000806666', 'Wedding/Event, Hyderabad.'),
    ('RFC Production', 'Unknown', '+917014441733', 'Wedding Photography, Jaipur.'),
    ('S&S International Event Management', 'Sanjay Kumar', '+918467815313', 'Event Management, Delhi.'),
    ('Dilli 59 Party Hall', 'Unknown', '+917428989896', 'Party/Event Venue, Delhi.'),
    ('The Pearl Ladies & Gents Beauty Salon', 'Unknown', '+919432342396', 'Beauty Salon, Kolkata.'),
    ('Gymnastics Training Center', 'Unknown', '+919987299389', 'Gym/Fitness, Indore.'),
    ('Monster Gym', 'Unknown', '+917314999925', 'Gym, Indore.'),
    ('Six Pack Fitness Club', 'Six Pack Gym Club', '+918349294444', 'Gym, Indore.'),
    ('CFS Gym Airport Road', 'Unknown', '+919977686925', 'Gym/Fitness, Indore.'),
    ('Bravo Fitness Center', 'Unknown', '+919893475846', 'Gym, Indore.'),
    ('City Gymkhana Club', 'Unknown', '+917312763199', 'Gym/Sports, Indore.'),
    ('LA World Fitness GYM', 'Unknown', '+917566666093', 'Gym, Indore.'),
    ('Fitness Studio', 'Unknown', '+919669608408', 'Gym, Indore.'),
    ('YFC Gym & Fitness Center', 'Unknown', '+917313062005', 'Gym, Indore.'),
    ('Aruna Studio', 'Satish Limmana', '+919949815656', 'Photography/Event, Hyderabad.'),
    ('Bhushan Chakote Architect & Interior', 'Bhushan Chakote', '+912025440651', 'Architecture/Interior, Pune.'),
    ('Atulya Patwardhan Architects', 'Atulya Patwardhan', '+912064004323', 'Architecture/Interior, Pune.'),
    ('Pebble Unisex Salon & Spa', 'Ashwani', '+919901166599', 'Salon/Spa, Bangalore.'),
    ('Cerise Hair & Skin', 'Rohit Panjabi', '+919163112525', 'Salon, Kolkata.'),
    ('Levia Professionals Beauty Care', 'Seema Verma', '+919831100900', 'Salon, Howrah.'),
    ('Pretty Woman Beauty Salon & Academy', 'Seahadri Vasan', '+918023610712', 'Salon/Academy, Bangalore.'),
    ('Atitude Beauty Solutions', 'Amisha Brid', '+919653397487', 'Beauty Salon, Mumbai.'),
    ('New Looks Family Salon & Academy', 'Ashok Sain', '+918875727694', 'Salon/Academy, Jodhpur.'),
    ('Daga Decorators', 'Ravikiran Daga', '+919422157237', 'Events/Decor, Amravati.'),
    ('Edit Zone', 'Ranjan Nath Deb', '+919614418949', 'Wedding Photography, Siliguri.'),
    ('My Party 101', 'Gourav Verma', '+919811228130', 'Events/Party, Ghaziabad.'),
    ('D-Diva''s Beauty Salon & Makeup Studio', 'Shruti Singh', '+918604660777', 'Salon/Makeup, Kanpur.'),
    ('Sparks & SP Eventz', 'Unknown', '+919831931453', 'Events, Kolkata.'),
    ('Tangerine Royale Banquets', 'Lakshya Pandey', '+919830952818', 'Banquet/Event Venue, Kolkata.')
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

-- COMMIT; or ROLLBACK;
