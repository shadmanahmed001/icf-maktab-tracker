/**
 * The An-Nasīḥah 2026–2027 syllabus as taught at the ICF Daily Maktab.
 *
 * This is reference data, not sample data: the terms, the per-grade subject
 * sequence and the memorization targets are the school's actual standards.
 * Administrators can edit any of it in the Curriculum screen once running.
 */

const TERMS = [
    {
      term_number: 1,
      title: 'Term 1',
      date_range: 'August – early October 2026',
      start_date: '2026-08-10',
      end_date: '2026-10-09',
      is_current: 1,
      is_interlude: 0,
      description: 'First teaching term introducing core foundations across all subjects.'
    },
    {
      term_number: 2,
      title: 'Term 2',
      date_range: 'October – early December 2026',
      start_date: '2026-10-12',
      end_date: '2026-12-18',
      is_current: 0,
      is_interlude: 0,
      description: 'Second teaching term building on foundations.'
    },
    {
      term_number: 3,
      title: 'Term 3',
      date_range: 'December – early February 2027',
      start_date: '2027-01-04',
      end_date: '2027-02-05',
      is_current: 0,
      is_interlude: 0,
      description: 'Third teaching term before Ramaḍān with winter break.'
    },
    {
      term_number: 0,
      title: 'Ramaḍān Interlude',
      date_range: '8 February – 10 March 2027',
      start_date: '2027-02-08',
      end_date: '2027-03-10',
      is_current: 0,
      is_interlude: 1,
      description: 'Consolidation and revision interlude on a reduced schedule. No new standards introduced.'
    },
    {
      term_number: 4,
      title: 'Term 4 (Year-End)',
      date_range: 'Mid-March – June 2027',
      start_date: '2027-03-15',
      end_date: '2027-06-25',
      is_current: 0,
      is_interlude: 0,
      description: 'Final term including spring break and year-end mastery assessment.'
    }
];

const CURRICULUM_TOPICS = [
    // GRADE 1
    // Term 1
    { grade: 1, gender_track: 'general', term: 1, day: 'Monday', subject: 'Fiqh', topic: 'Intro to Fiqh; the Five Pillars of Islam; the Shahādah', indicator: 'Name the five pillars; recite and explain the Shahādah', seq: 1 },
    { grade: 1, gender_track: 'general', term: 1, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Intro to Ḥadīth; Ḥadīth 1 (Feeding the hungry)', indicator: 'Recite Ḥadīth 1 with its meaning', seq: 1 },
    { grade: 1, gender_track: 'general', term: 1, day: 'Wednesday', subject: 'Sīrah', topic: 'Childhood and youth of the Prophet ﷺ', indicator: "Recount the Prophet ﷺ's childhood and youth", seq: 1 },
    { grade: 1, gender_track: 'general', term: 1, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Intro to ʿAqā\'id; the Articles of Faith', indicator: 'List the articles of faith', seq: 1 },
    { grade: 1, gender_track: 'general', term: 1, day: 'Friday', subject: 'Akhlāq', topic: 'Respect', indicator: 'Show respect to parents, elders, and teachers', seq: 1 },
    // Term 2
    { grade: 1, gender_track: 'general', term: 2, day: 'Monday', subject: 'Fiqh', topic: 'Ṣalāh, Zakāh, Ṣawm, and Ḥajj (the remaining pillars)', indicator: 'Briefly explain each of the remaining four pillars', seq: 2 },
    { grade: 1, gender_track: 'general', term: 2, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 2 (The best person)', indicator: 'Recite Ḥadīth 2 with its meaning', seq: 2 },
    { grade: 1, gender_track: 'general', term: 2, day: 'Wednesday', subject: 'Sīrah', topic: 'Marriage; important names and relatives', indicator: "Name the Prophet ﷺ's family; recount his marriage", seq: 2 },
    { grade: 1, gender_track: 'general', term: 2, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Ar-Razzāq (The Provider)', indicator: 'Explain that Allāh alone is the Provider', seq: 2 },
    { grade: 1, gender_track: 'general', term: 2, day: 'Friday', subject: 'Akhlāq', topic: 'Cleanliness (body, surroundings, water)', indicator: 'Keep body and surroundings clean', seq: 2 },
    // Term 3
    { grade: 1, gender_track: 'general', term: 3, day: 'Monday', subject: 'Fiqh', topic: 'Ṭahārah (with practical demonstration)', indicator: 'Explain ṭahārah and its importance', seq: 3 },
    { grade: 1, gender_track: 'general', term: 3, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 3 (Doing things calmly)', indicator: 'Recite Ḥadīth 3 with its meaning', seq: 3 },
    { grade: 1, gender_track: 'general', term: 3, day: 'Wednesday', subject: 'Tārīkh', topic: 'Creation of Ādam AS; Ādam & Ḥawwā\'', indicator: 'Retell the creation of Ādam AS', seq: 3 },
    { grade: 1, gender_track: 'general', term: 3, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Ar-Raḥmān (The Most Merciful)', indicator: "Explain Allāh's mercy", seq: 3 },
    { grade: 1, gender_track: 'general', term: 3, day: 'Friday', subject: 'Akhlāq', topic: 'Gentleness in speech; Smiling', indicator: 'Speak gently and greet others with a smile', seq: 3 },
    // Term 4
    { grade: 1, gender_track: 'general', term: 4, day: 'Monday', subject: 'Fiqh', topic: 'Wuḍū\' (with practical demonstration); year revision', indicator: "Perform wuḍū' correctly in sequence", seq: 4 },
    { grade: 1, gender_track: 'general', term: 4, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 4 (Purity), 5 (Truth); revision', indicator: 'Recite all five aḥādīth from memory', seq: 4 },
    { grade: 1, gender_track: 'general', term: 4, day: 'Wednesday', subject: 'Tārīkh', topic: 'Nūḥ AS; revision', indicator: 'Retell the story of Nūḥ AS and the flood', seq: 4 },
    { grade: 1, gender_track: 'general', term: 4, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Recall Ar-Razzāq and Ar-Raḥmān; revision', indicator: 'Recall both names with their meanings', seq: 4 },
    { grade: 1, gender_track: 'general', term: 4, day: 'Friday', subject: 'Ādāb', topic: 'Beginning with the right; then Ādāb of eating, drinking, sleeping, waking, washroom', indicator: 'Demonstrate the ādāb of eating, sleeping, and the washroom', seq: 4 },

    // GRADE 2
    // Term 1
    { grade: 2, gender_track: 'general', term: 1, day: 'Monday', subject: 'Fiqh', topic: 'Keeping clean / Wuḍū\'; key words of wuḍū\'', indicator: "Define wuḍū' key terms; describe staying clean", seq: 1 },
    { grade: 2, gender_track: 'general', term: 1, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth: Truth', indicator: 'Recite the ḥadīth on truthfulness with meaning', seq: 1 },
    { grade: 2, gender_track: 'general', term: 1, day: 'Wednesday', subject: 'Sīrah', topic: 'The Cave of Ḥirā\'; the first revelation', indicator: 'Recount the first revelation at Ḥirā\'', seq: 1 },
    { grade: 2, gender_track: 'general', term: 1, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Articles of Faith; Allāh the Protector', indicator: 'List the articles of faith; explain al-Ḥafīẓ', seq: 1 },
    { grade: 2, gender_track: 'general', term: 1, day: 'Friday', subject: 'Akhlāq', topic: 'Keeping promises', indicator: 'Explain the importance of keeping promises', seq: 1 },
    // Term 2
    { grade: 2, gender_track: 'general', term: 2, day: 'Monday', subject: 'Fiqh', topic: 'How many of each in wuḍū\'; farā\'iḍ and sunan of wuḍū\'', indicator: "List the farā'iḍ and sunan of wuḍū'", seq: 2 },
    { grade: 2, gender_track: 'general', term: 2, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth: Salām', indicator: 'Recite the ḥadīth on spreading salām', seq: 2 },
    { grade: 2, gender_track: 'general', term: 2, day: 'Wednesday', subject: 'Sīrah', topic: 'The first believers; the invitation (Mount Ṣafā); trouble to early Muslims', indicator: 'Recount the open call and early persecution', seq: 2 },
    { grade: 2, gender_track: 'general', term: 2, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The All-Hearing; the All-Seeing', indicator: 'Explain Allāh as as-Samīʿ and al-Baṣīr', seq: 2 },
    { grade: 2, gender_track: 'general', term: 2, day: 'Friday', subject: 'Akhlāq', topic: 'Being thankful', indicator: 'Show gratitude to Allāh and to people', seq: 2 },
    // Term 3
    { grade: 2, gender_track: 'general', term: 3, day: 'Monday', subject: 'Fiqh', topic: 'Nawāqiḍ, makrūhāt, and mustaḥabbāt of wuḍū\'', indicator: "List what breaks wuḍū' and its disliked/liked acts", seq: 3 },
    { grade: 2, gender_track: 'general', term: 3, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth: Using the right hand', indicator: 'Recite the ḥadīth on using the right hand', seq: 3 },
    { grade: 2, gender_track: 'general', term: 3, day: 'Wednesday', subject: 'Tārīkh', topic: 'Hūd AS', indicator: 'Retell the story of Hūd AS and ʿĀd', seq: 3 },
    { grade: 2, gender_track: 'general', term: 3, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The One (al-Wāḥid)', indicator: 'Explain the oneness of Allāh', seq: 3 },
    { grade: 2, gender_track: 'general', term: 3, day: 'Friday', subject: 'Akhlāq', topic: 'Spreading Islam; helping in good things', indicator: 'Give examples of helping in good', seq: 3 },
    // Term 4
    { grade: 2, gender_track: 'general', term: 4, day: 'Monday', subject: 'Fiqh', topic: 'Tayammum; the method of ṣalāh (with demonstration); revision', indicator: 'Perform tayammum and the method of ṣalāh', seq: 4 },
    { grade: 2, gender_track: 'general', term: 4, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Drinking while sitting; kindness to neighbors; revision', indicator: 'Recite all five aḥādīth from memory', seq: 4 },
    { grade: 2, gender_track: 'general', term: 4, day: 'Wednesday', subject: 'Tārīkh', topic: 'Ṣāliḥ AS (Thamūd); revision', indicator: 'Retell the story of Ṣāliḥ AS and the she-camel', seq: 4 },
    { grade: 2, gender_track: 'general', term: 4, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Angels & Jibra\'īl; the Books; the Qur\'ān; revision', indicator: 'Explain belief in angels, books, and the Qur\'ān', seq: 4 },
    { grade: 2, gender_track: 'general', term: 4, day: 'Friday', subject: 'Ādāb', topic: 'Kindness to animals; then Ādāb of greeting, entering a house / seeking permission, speaking, sneezing & yawning', indicator: 'Demonstrate the ādāb of greeting and seeking permission', seq: 4 },

    // GRADE 3
    // Term 1
    { grade: 3, gender_track: 'general', term: 1, day: 'Monday', subject: 'Fiqh', topic: 'Key words of Fiqh; types of najāsah; ghusl (farā\'iḍ & sunan)', indicator: 'Define Fiqh terms; identify najāsah; perform ghusl', seq: 1 },
    { grade: 3, gender_track: 'general', term: 1, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Intro; Ḥadīth 1 (Ṣalāh), 2 (Love for others), 3 (Steadfastness)', indicator: 'Recite and explain Aḥādīth 1–3', seq: 1 },
    { grade: 3, gender_track: 'general', term: 1, day: 'Wednesday', subject: 'Sīrah', topic: 'Migration to Abyssinia; two warriors accept Islam; a different way; the boycott; the year of sadness', indicator: 'Explain the Abyssinia migration and the hardship period', seq: 1 },
    { grade: 3, gender_track: 'general', term: 1, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The Messengers; the two types of Messengers', indicator: 'Distinguish nabī from rasūl', seq: 1 },
    { grade: 3, gender_track: 'general', term: 1, day: 'Friday', subject: 'Akhlāq', topic: 'Thinking good of others; sharing', indicator: 'Explain ḥusn al-ẓann and sharing with examples', seq: 1 },
    // Term 2
    { grade: 3, gender_track: 'general', term: 2, day: 'Monday', subject: 'Fiqh', topic: 'Ṣalāh: rakaʿāt, conditions, farā\'iḍ acts, nawāqiḍ', indicator: 'List the rakaʿāt, conditions, farā\'iḍ, and nullifiers of ṣalāh', seq: 2 },
    { grade: 3, gender_track: 'general', term: 2, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 4 (Life), 5 (This world), 6 (Duʿā\')', indicator: 'Recite and explain Aḥādīth 4–6', seq: 2 },
    { grade: 3, gender_track: 'general', term: 2, day: 'Wednesday', subject: 'Sīrah', topic: 'Journey to Ṭā\'if; inviting the Arab tribes; al-Isrā\' wal-Miʿrāj (event, the heavens, the gift of ṣalāh)', indicator: 'Narrate the Miʿrāj and its link to the five ṣalāh', seq: 2 },
    { grade: 3, gender_track: 'general', term: 2, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Messengers named in the Qur\'ān (memorization); the poem on the prophets', indicator: 'Recite the named messengers and the poem', seq: 2 },
    { grade: 3, gender_track: 'general', term: 2, day: 'Friday', subject: 'Akhlāq', topic: 'Kindness to parents; speaking the truth (with story)', indicator: 'Explain birr al-wālidayn; state the truth story\'s moral', seq: 2 },
    // Term 3
    { grade: 3, gender_track: 'general', term: 3, day: 'Monday', subject: 'Fiqh', topic: 'The full method of ṣalāh (both halves) with practical demonstration', indicator: 'Perform ṣalāh with correct method and arkān', seq: 3 },
    { grade: 3, gender_track: 'general', term: 3, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 7 (Guests), 8 (Mercy)', indicator: 'Recite and explain Aḥādīth 7–8', seq: 3 },
    { grade: 3, gender_track: 'general', term: 3, day: 'Wednesday', subject: 'Tārīkh', topic: 'Ibrāhīm AS: his life; the idols; the people return; before the king', indicator: 'Narrate Ibrāhīm AS\'s early daʿwah and confrontation', seq: 3 },
    { grade: 3, gender_track: 'general', term: 3, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Qiyāmah (introduction)', indicator: 'State the basic belief in Qiyāmah', seq: 3 },
    { grade: 3, gender_track: 'general', term: 3, day: 'Friday', subject: 'Ādāb', topic: 'Saying a good word; Akhlāq revision; then Ādāb of traveling', indicator: 'Consolidate the five akhlāq; state the ādāb of travel', seq: 3 },
    // Term 4
    { grade: 3, gender_track: 'general', term: 4, day: 'Monday', subject: 'Fiqh', topic: 'Ṣalāt al-Witr with Duʿā\' Qunūt; Qaṣr; Ṣalāt al-Marīḍ; revision', indicator: 'Perform Witr with Qunūt; explain Qaṣr and the sick person\'s ṣalāh', seq: 4 },
    { grade: 3, gender_track: 'general', term: 4, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 9 (Modesty), 10 (Shukr); revision', indicator: 'Recite and explain all ten aḥādīth from memory', seq: 4 },
    { grade: 3, gender_track: 'general', term: 4, day: 'Wednesday', subject: 'Tārīkh', topic: 'To Makkah; Zamzam; the sacrifice of Ismāʿīl; building the Kaʿbah; revision', indicator: 'Sequence the Ibrāhīm–Ismāʿīl narrative through the Kaʿbah', seq: 4 },
    { grade: 3, gender_track: 'general', term: 4, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The Minor Signs and the Major Signs; revision', indicator: 'Identify the minor and major signs; recall the named messengers', seq: 4 },
    { grade: 3, gender_track: 'general', term: 4, day: 'Friday', subject: 'Ādāb', topic: 'Ādāb of studying, the Qur\'ān, walking, the masjid; revision', indicator: 'Demonstrate masjid and Qur\'ān ādāb; consolidate all five', seq: 4 },

    // GRADE 4
    // Term 1
    { grade: 4, gender_track: 'general', term: 1, day: 'Monday', subject: 'Fiqh', topic: 'Masaḥ ʿalal khuffayn: conditions, types, and points of masaḥ', indicator: 'Explain masaḥ ʿalal khuffayn and its conditions', seq: 1 },
    { grade: 4, gender_track: 'general', term: 1, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 1 (Feeding others), 2 (No to racism), 3 (Good character)', indicator: 'Recite and explain Aḥādīth 1–3', seq: 1 },
    { grade: 4, gender_track: 'general', term: 1, day: 'Wednesday', subject: 'Sīrah', topic: 'The first and second pledges of ʿAqabah; the Hijrah; arrival in Madīnah', indicator: 'Recount the pledges and the Hijrah', seq: 1 },
    { grade: 4, gender_track: 'general', term: 1, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The Major Signs (overview); the Mahdī', indicator: 'List the major signs; describe the Mahdī', seq: 1 },
    { grade: 4, gender_track: 'general', term: 1, day: 'Friday', subject: 'Akhlāq', topic: 'Trust (amānah)', indicator: 'Explain the meaning and importance of amānah', seq: 1 },
    // Term 2
    { grade: 4, gender_track: 'general', term: 2, day: 'Monday', subject: 'Fiqh', topic: 'Nawāqiḍ of masaḥ; masaḥ on a wound; the wājib acts of ṣalāh', indicator: 'List the wājibāt of ṣalāh', seq: 2 },
    { grade: 4, gender_track: 'general', term: 2, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 4 (Thanking others), 5 (Friends), 6 (Kindness)', indicator: 'Recite and explain Aḥādīth 4–6', seq: 2 },
    { grade: 4, gender_track: 'general', term: 2, day: 'Wednesday', subject: 'Sīrah', topic: 'Islamic brotherhood; treaties & the hypocrites; Badr, Uḥud, Aḥzāb', indicator: 'Sequence the major early battles of Madīnah', seq: 2 },
    { grade: 4, gender_track: 'general', term: 2, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The Dajjāl; his stories and protection against him', indicator: 'Describe the Dajjāl and how to seek protection', seq: 2 },
    { grade: 4, gender_track: 'general', term: 2, day: 'Friday', subject: 'Akhlāq', topic: 'Seeking permission before entering', indicator: 'Explain the etiquette of seeking permission', seq: 2 },
    // Term 3
    { grade: 4, gender_track: 'general', term: 3, day: 'Monday', subject: 'Fiqh', topic: 'Sajdah sahw; ṣawm — breaking the fast; actions that do not break it', indicator: 'Explain sajdah sahw and what breaks the fast', seq: 3 },
    { grade: 4, gender_track: 'general', term: 3, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 7 (Trust), 8 (Keys to Paradise), 9 (Dhikr)', indicator: 'Recite and explain Aḥādīth 7–9', seq: 3 },
    { grade: 4, gender_track: 'general', term: 3, day: 'Wednesday', subject: 'Tārīkh', topic: 'Yūsuf AS: the dream; the incident leading to prison', indicator: 'Recount Yūsuf AS\'s dream and imprisonment', seq: 3 },
    { grade: 4, gender_track: 'general', term: 3, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The role of ʿĪsā AS; Yājūj and Mājūj', indicator: 'Explain the descent of ʿĪsā AS and Yājūj/Mājūj', seq: 3 },
    { grade: 4, gender_track: 'general', term: 3, day: 'Friday', subject: 'Akhlāq', topic: 'Removing harm from the road', indicator: 'Give examples of removing harm from the path', seq: 3 },
    // Term 4
    { grade: 4, gender_track: 'general', term: 4, day: 'Monday', subject: 'Fiqh', topic: 'Ṣawm: those excused and fidyah; tarāwīḥ; revision', indicator: 'Explain who is excused, fidyah, and tarāwīḥ', seq: 4 },
    { grade: 4, gender_track: 'general', term: 4, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 10 (Duʿā\'); revision', indicator: 'Recite and explain all ten aḥādīth from memory', seq: 4 },
    { grade: 4, gender_track: 'general', term: 4, day: 'Wednesday', subject: 'Tārīkh', topic: 'Yūsuf AS: guardian of the storehouses; reunion with his father; revision', indicator: 'Complete the story of Yūsuf AS', seq: 4 },
    { grade: 4, gender_track: 'general', term: 4, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The beast; the sun from the west; the smoke; landslides; Qiyāmah & intercession; the Bridge; revision', indicator: 'Describe the remaining major signs and the Bridge', seq: 4 },
    { grade: 4, gender_track: 'general', term: 4, day: 'Friday', subject: 'Ādāb', topic: 'Being a good neighbor; then Ādāb of duʿā\', dressing, guests & hosts, gatherings, istinjā\'', indicator: 'Demonstrate the ādāb of duʿā\', dressing, and hosting guests', seq: 4 },

    // GRADE 5
    // Term 1
    { grade: 5, gender_track: 'general', term: 1, day: 'Monday', subject: 'Fiqh', topic: 'Miscellaneous points of wuḍū\'; tayammum in detail', indicator: 'Explain the finer points of wuḍū\' and tayammum', seq: 1 },
    { grade: 5, gender_track: 'general', term: 1, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 1 (Promise), 2 (Tongue), 3 (Ghībah)', indicator: 'Recite and explain Aḥādīth 1–3', seq: 1 },
    { grade: 5, gender_track: 'general', term: 1, day: 'Wednesday', subject: 'Sīrah', topic: 'The Treaty of Ḥudaybiyah; Bayʿah ar-Riḍwān; ʿUmrah al-Qaḍā\'', indicator: 'Recount Ḥudaybiyah and its outcome', seq: 1 },
    { grade: 5, gender_track: 'general', term: 1, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Death and its types (good and bad); the journey after death', indicator: 'Explain the types of death and what follows', seq: 1 },
    { grade: 5, gender_track: 'general', term: 1, day: 'Friday', subject: 'Akhlāq', topic: 'Mashwarah (consultation)', indicator: 'Explain the value of consultation', seq: 1 },
    // Term 2
    { grade: 5, gender_track: 'general', term: 2, day: 'Monday', subject: 'Fiqh', topic: 'Sunan of ṣalāh (qiyām, qirā\'ah, rukūʿ, sajdah, qaʿdah); forbidden & disliked times', indicator: 'List the sunan of ṣalāh and the disliked times', seq: 2 },
    { grade: 5, gender_track: 'general', term: 2, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 4 (Intoxicants), 5 (Beauty of a person\'s Islam), 6 (Carrying tales)', indicator: 'Recite and explain Aḥādīth 4–6', seq: 2 },
    { grade: 5, gender_track: 'general', term: 2, day: 'Wednesday', subject: 'Sīrah', topic: 'Conquest of Makkah; Ḥunayn; Tabūk; the Farewell Pilgrimage; the Prophet ﷺ leaves the world', indicator: 'Sequence Ḥudaybiyah through the Farewell Pilgrimage', seq: 2 },
    { grade: 5, gender_track: 'general', term: 2, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The questioning in the grave; the life of the qabr', indicator: 'Explain the questioning and life of the grave', seq: 2 },
    { grade: 5, gender_track: 'general', term: 2, day: 'Friday', subject: 'Akhlāq', topic: 'Ṣabr (patience)', indicator: 'Explain the levels and reward of patience', seq: 2 },
    // Term 3
    { grade: 5, gender_track: 'general', term: 3, day: 'Monday', subject: 'Fiqh', topic: 'Ṣalāh of a masbūq; qaḍā\' ṣalāh; ʿĪd ṣalāh', indicator: 'Explain the masbūq, qaḍā\', and ʿĪd ṣalāh', seq: 3 },
    { grade: 5, gender_track: 'general', term: 3, day: 'Tuesday', subject: 'Aḥādīth', topic: 'The Qualities of Allāh — begin the 99 Names (memorization)', indicator: 'Begin memorizing the 99 Names of Allāh', seq: 3 },
    { grade: 5, gender_track: 'general', term: 3, day: 'Wednesday', subject: 'Tārīkh', topic: 'Mūsā AS: his return; shelter outside Egypt; his miracles; Firʿawn\'s arrogance', indicator: 'Recount the life and miracles of Mūsā AS', seq: 3 },
    { grade: 5, gender_track: 'general', term: 3, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Jannah; seeing Allāh; actions that lead to Jannah; ʿAsharah Mubashsharah', indicator: 'Describe Jannah and the actions that lead to it', seq: 3 },
    { grade: 5, gender_track: 'general', term: 3, day: 'Friday', subject: 'Akhlāq', topic: 'Ties of kinship (ṣilat ar-raḥim)', indicator: 'Explain the duty of maintaining kinship', seq: 3 },
    // Term 4
    { grade: 5, gender_track: 'general', term: 4, day: 'Monday', subject: 'Fiqh', topic: 'ʿUmrah & Ḥajj (iḥrām, ṭawāf, saʿī, types, farā\'iḍ, the five days); Ziyārah; revision', indicator: 'Outline the rites of ʿUmrah and Ḥajj in order', seq: 4 },
    { grade: 5, gender_track: 'general', term: 4, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Muʿawwadhāt; speaking good; good character; complete the 99 Names; revision', indicator: 'Recite all ten aḥādīth and the 99 Names', seq: 4 },
    { grade: 5, gender_track: 'general', term: 4, day: 'Wednesday', subject: 'Tārīkh', topic: 'ʿĪsā AS: the miraculous birth; his miracles; our belief in him; revision', indicator: 'Recount the birth and miracles of ʿĪsā AS; state our belief', seq: 4 },
    { grade: 5, gender_track: 'general', term: 4, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Jahannam and the actions that lead to it; Aʿrāf; Qadr; belief in Allāh, the Prophets, and the Ṣaḥābah; revision', indicator: 'Describe Jahannam and state the core beliefs', seq: 4 },
    { grade: 5, gender_track: 'general', term: 4, day: 'Friday', subject: 'Ādāb', topic: 'Exchanging gifts & honouring guests; dhikr; then Ādāb of ghusl, social interaction, writing, siwāk, visiting the sick', indicator: 'Demonstrate the ādāb of ghusl, siwāk, and visiting the sick', seq: 4 },

    // GRADE 6 (With Boys & Girls variations)
    // Term 1
    { grade: 6, gender_track: 'general', term: 1, day: 'Monday', subject: 'Fiqh', topic: 'Types of water; impurities and cleaning methods', indicator: 'Classify types of water and methods of cleaning impurities', seq: 1 },
    { grade: 6, gender_track: 'general', term: 1, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 1 (Major sins), 2 (Pride), 3 (Good character), 4 (Health & free time)', indicator: 'Recite and explain Aḥādīth 1–4', seq: 1 },
    { grade: 6, gender_track: 'general', term: 1, day: 'Wednesday', subject: 'Sīrah', topic: 'The Prophet ﷺ\'s shamā\'il; Abū Bakr aṣ-Ṣiddīq', indicator: 'Describe the shamā\'il and the life of Abū Bakr', seq: 1 },
    { grade: 6, gender_track: 'general', term: 1, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Ahlus Sunnah; nubuwwah', indicator: 'Define nubuwwah within the Ahlus Sunnah creed', seq: 1 },
    { grade: 6, gender_track: 'general', term: 1, day: 'Friday', subject: 'Akhlāq', topic: 'Oppression and bullying', indicator: 'Explain the sin of oppression and bullying', seq: 1 },
    // Term 2 - Boys Track
    { grade: 6, gender_track: 'boys', term: 2, day: 'Monday', subject: 'Fiqh', topic: 'Maturity (bulūgh) — boys\' track: imāmah, adhān & iqāmah, Jumuʿah; the wājib acts of ṣalāh', indicator: 'Explain signs of maturity, adhān, imāmah, and wājibāt of ṣalāh', seq: 2 },
    // Term 2 - Girls Track
    { grade: 6, gender_track: 'girls', term: 2, day: 'Monday', subject: 'Fiqh', topic: 'Maturity (bulūgh) — girls\' track: fiqh of ḥayḍ, nifās, and istiḥāḍah; the wājib acts of ṣalāh', indicator: 'Explain signs of maturity, rules of ḥayḍ/nifās, and wājibāt of ṣalāh', seq: 2 },
    { grade: 6, gender_track: 'general', term: 2, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 5 (Truth & lies), 6 (Love for the Messenger ﷺ), 7 (Five pillars), 8 (Qur\'ān)', indicator: 'Recite and explain Aḥādīth 5–8', seq: 2 },
    { grade: 6, gender_track: 'general', term: 2, day: 'Wednesday', subject: 'Sīrah', topic: 'The Mothers of the Believers', indicator: 'Name the Mothers of the Believers and their virtues', seq: 2 },
    { grade: 6, gender_track: 'general', term: 2, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The qualities of the Prophets; the status of the Prophets', indicator: 'Describe the qualities and rank of the Prophets', seq: 2 },
    { grade: 6, gender_track: 'general', term: 2, day: 'Friday', subject: 'Akhlāq', topic: 'Envy (ḥasad)', indicator: 'Explain the danger of envy', seq: 2 },
    // Term 3
    { grade: 6, gender_track: 'general', term: 3, day: 'Monday', subject: 'Fiqh', topic: 'Janā\'iz: the method of ghusl for the deceased, shrouding, and burial', indicator: 'Outline the method of ghusl, kafan, and burial', seq: 3 },
    { grade: 6, gender_track: 'general', term: 3, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 9 (Ṣalāh), 10 (Kindness to parents), 11 (Gatherings)', indicator: 'Recite and explain Aḥādīth 9–11', seq: 3 },
    { grade: 6, gender_track: 'general', term: 3, day: 'Wednesday', subject: 'Tārīkh', topic: 'Dāwūd & Sulaymān AS; Yūnus AS', indicator: 'Recount Dāwūd, Sulaymān, and Yūnus AS', seq: 3 },
    { grade: 6, gender_track: 'general', term: 3, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'The Ṣaḥābah; the status of different Ṣaḥābah', indicator: 'Explain the ranks of the Ṣaḥābah', seq: 3 },
    { grade: 6, gender_track: 'general', term: 3, day: 'Friday', subject: 'Akhlāq', topic: 'Ghībah (backbiting)', indicator: 'Explain the sin of backbiting', seq: 3 },
    // Term 4
    { grade: 6, gender_track: 'general', term: 4, day: 'Monday', subject: 'Fiqh', topic: 'Consolidation of ṭahārah, the wājibāt of ṣalāh, and janā\'iz; revision', indicator: 'Demonstrate mastery of the year\'s fiqh', seq: 4 },
    { grade: 6, gender_track: 'general', term: 4, day: 'Tuesday', subject: 'Aḥādīth', topic: 'Ḥadīth 12 (Good actions), 13 (Ṣadaqah), 14 (Ramaḍān), 15 (Friendship); revision', indicator: 'Recite all fifteen aḥādīth from memory', seq: 4 },
    { grade: 6, gender_track: 'general', term: 4, day: 'Wednesday', subject: 'Tārīkh', topic: 'The Umayyads; the Umayyad contribution to the world; revision', indicator: 'Outline the Umayyad period and its contributions', seq: 4 },
    { grade: 6, gender_track: 'general', term: 4, day: 'Thursday', subject: 'ʿAqā\'id', topic: 'Awliyā\'; muʿjizāt; al-Isrā\' wal-Miʿrāj; karāmāt; revision', indicator: 'Distinguish a muʿjizah from a karāmah', seq: 4 },
    { grade: 6, gender_track: 'general', term: 4, day: 'Friday', subject: 'Ādāb', topic: 'Pride; following the Sunnah; adhān & modesty in dress; then Ādāb of moderation in expenditure, women in society, personal hygiene', indicator: 'Demonstrate the ādāb of modesty, moderation, and hygiene', seq: 4 },
];

const MEMORIZATION_STANDARDS = [
    // Grade 1
    { grade: 1, term: 1, surah: 'Al-Lahab', dua: '4th & 5th Kalimah; Takbīr Taḥrīmah', names: 'Names 1–3' },
    { grade: 1, term: 2, surah: 'An-Naṣr', dua: 'Duʿā\' al-Istiftāḥ; Tasbīḥ of rukūʿ; after rukūʿ', names: 'Names 4–6' },
    { grade: 1, term: 3, surah: 'Al-Kāfirūn', dua: 'During qawmah; Tasbīḥ in sujūd; between the two sajdah', names: 'Names 7–8' },
    { grade: 1, term: 4, surah: 'Consolidate all three (Al-Lahab, An-Naṣr, Al-Kāfirūn)', dua: 'Salām to end ṣalāh; to increase knowledge', names: 'Names 9–10 (10 total)' },

    // Grade 2
    { grade: 2, term: 1, surah: 'Al-Kawthar; Al-Māʿūn', dua: 'Īmān Mujmal; Īmān Mufaṣṣal', names: 'Names 1–3' },
    { grade: 2, term: 2, surah: 'Quraysh', dua: 'Tashahhud; Ṣalawāt (Durūd Ibrāhīm)', names: 'Names 4–6' },
    { grade: 2, term: 3, surah: 'Al-Fīl', dua: 'Before salām; before & during wuḍū\'', names: 'Names 7–8' },
    { grade: 2, term: 4, surah: 'Al-Humazah; consolidate all five', dua: 'After wuḍū\'; entering & exiting the masjid', names: 'Names 9–10 (10 total)' },

    // Grade 3
    { grade: 3, term: 1, surah: 'Al-ʿAṣr; At-Takāthur', dua: 'For parents; entering & leaving the house', names: 'Names 1–3' },
    { grade: 3, term: 2, surah: 'Al-Qāriʿah', dua: 'Qunūt; wearing & taking off clothes', names: 'Names 4–6' },
    { grade: 3, term: 3, surah: 'Al-ʿĀdiyāt', dua: 'Breaking fast; after Ifṭār; eating at another\'s house; traveling', names: 'Names 7–8' },
    { grade: 3, term: 4, surah: 'Az-Zalzalah; consolidate all five', dua: 'On seeing a smile; duʿā\' to a host; when it rains; looking in the mirror', names: 'Names 9–10 (10 total)' },

    // Grade 4
    { grade: 4, term: 1, surah: 'Al-Bayyinah', dua: 'Āyat al-Kursī; the Adhān', names: 'Names 1–4' },
    { grade: 4, term: 2, surah: 'Al-Qadr', dua: 'Extra words for Fajr adhān; replying to the adhān; duʿā\' after adhān', names: 'Names 5–8' },
    { grade: 4, term: 3, surah: 'Al-ʿAlaq', dua: 'Janāzah duʿā\'; Janāzah duʿā\' for male & female infants', names: 'Names 9–11' },
    { grade: 4, term: 4, surah: 'At-Tīn; consolidate all four', dua: 'On hearing a dog bark; drinking Zamzam', names: 'Names 12–15 (15 total)' },

    // Grade 5
    { grade: 5, term: 1, surah: 'Al-Inshirāḥ', dua: 'Protection from all calamities; end of a gathering', names: 'Names 1–4' },
    { grade: 5, term: 2, surah: 'Aḍ-Ḍuḥā', dua: 'When feeling pain; visiting the sick; when in distress', names: 'Names 5–8' },
    { grade: 5, term: 3, surah: 'Last 2 āyāt of al-Baqarah', dua: 'When angry; happiness with Islam; at the time of need', names: 'Names 9–11' },
    { grade: 5, term: 4, surah: 'Consolidate all three', dua: 'Laylat al-Qadr; on seeing a new moon', names: 'Names 12–15 (15 total)' },

    // Grade 6
    { grade: 6, term: 1, surah: '1st 10 āyāt of al-Kahf', dua: 'Sayyid al-Istighfār; protection from the evil eye', names: 'Names 1–4' },
    { grade: 6, term: 2, surah: 'Last 2 āyāt of al-Ḥashr', dua: 'Returning from a journey; farewell; in the marketplace', names: 'Names 5–8' },
    { grade: 6, term: 3, surah: 'Sūrah Yāsīn — Rukūʿ 1', dua: 'Wearing new clothes; seeing another in new clothes; removing fear before sleep', names: 'Names 9–11' },
    { grade: 6, term: 4, surah: 'Sūrah Yāsīn — Rukūʿ 2–3; consolidate', dua: 'Waking during the night; intending to enter a town or city', names: 'Names 12–15 (15 total)' },
];

module.exports = { TERMS, CURRICULUM_TOPICS, MEMORIZATION_STANDARDS };
