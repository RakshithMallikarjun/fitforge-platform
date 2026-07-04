
-- Seed demo gym: Iron Works Performance
DO $seed$
DECLARE
  v_gym_id uuid;
  v_admin_id uuid := 'aaaa1111-0000-0000-0000-000000000001';
  v_trainer_ids uuid[] := ARRAY['bbbb2222-0000-0000-0000-000000000001','bbbb2222-0000-0000-0000-000000000002']::uuid[];
  v_member_ids uuid[] := ARRAY[
    'cccc3333-0000-0000-0000-000000000001','cccc3333-0000-0000-0000-000000000002',
    'cccc3333-0000-0000-0000-000000000003','cccc3333-0000-0000-0000-000000000004',
    'cccc3333-0000-0000-0000-000000000005','cccc3333-0000-0000-0000-000000000006',
    'cccc3333-0000-0000-0000-000000000007','cccc3333-0000-0000-0000-000000000008'
  ]::uuid[];
  v_member_names text[] := ARRAY['Alex Rivera','Sam Chen','Jordan Blake','Taylor Kim','Casey Morgan','Riley Patel','Morgan Reed','Devin Cruz'];
  v_member_expiries date[] := ARRAY[
    (CURRENT_DATE - 30), (CURRENT_DATE - 10),  -- expired
    (CURRENT_DATE + 5),                          -- expiring soon
    (CURRENT_DATE + 60),(CURRENT_DATE + 90),(CURRENT_DATE + 120),(CURRENT_DATE + 180),(CURRENT_DATE + 365)
  ]::date[];
  v_trainer_names text[] := ARRAY['Jamie Fox','Chris Nolan'];
  v_all_user_ids uuid[];
  v_uid uuid;
  v_email text;
  v_name text;
  v_role text;
  v_pw text := crypt('demo1234', gen_salt('bf'));
  v_ex_ids uuid[];
  v_plan_id uuid;
  v_day_id uuid;
  v_log_id uuid;
  v_trainer_id uuid;
  v_member_idx int;
  v_day_idx int;
  v_i int;
  v_j int;
  v_k int;
  v_status text;
  v_base_weight numeric;
  v_date date;
BEGIN
  -- Bail out if already seeded
  IF EXISTS (SELECT 1 FROM public.gyms WHERE slug = 'ironworks') THEN
    RAISE NOTICE 'Ironworks demo gym already seeded, skipping.';
    RETURN;
  END IF;

  -- 1) Gym
  INSERT INTO public.gyms (id, name, slug, primary_color, font_family, subscription_plan)
  VALUES (gen_random_uuid(), 'Iron Works Performance', 'ironworks', '#DC2626', 'Satoshi', 'starter')
  RETURNING id INTO v_gym_id;

  -- Grab a stable set of 10 global exercises
  SELECT array_agg(id) INTO v_ex_ids FROM (
    SELECT id FROM public.exercises WHERE gym_id IS NULL
      AND name IN ('Back Squat','Barbell Bench Press','Conventional Deadlift','Overhead Press',
                   'Pull Up','Barbell Row','Romanian Deadlift','Leg Press','Lat Pulldown','Push Up')
    ORDER BY name
  ) t;

  -- 2/3/4) Create auth.users; handle_new_user trigger creates public.users, user_roles, member_profiles
  v_all_user_ids := ARRAY[v_admin_id] || v_trainer_ids || v_member_ids;

  FOR v_i IN 1..array_length(v_all_user_ids,1) LOOP
    v_uid := v_all_user_ids[v_i];
    IF v_i = 1 THEN
      v_email := 'admin@ironworks.demo';
      v_name := 'Admin — Iron Works';
      v_role := 'admin';
    ELSIF v_i <= 3 THEN
      v_email := 'trainer' || (v_i-1) || '@ironworks.demo';
      v_name := v_trainer_names[v_i-1];
      v_role := 'trainer';
    ELSE
      v_member_idx := v_i - 3;
      v_email := 'member' || v_member_idx || '@ironworks.demo';
      v_name := v_member_names[v_member_idx];
      v_role := 'member';
    END IF;

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, v_pw, now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('gym_slug','ironworks','role',v_role,'display_name',v_name),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_uid, v_uid::text, jsonb_build_object('sub', v_uid::text, 'email', v_email), 'email', now(), now(), now());
  END LOOP;

  -- Update member profiles with membership expiry + experience
  FOR v_i IN 1..8 LOOP
    UPDATE public.member_profiles
    SET membership_expires_at = v_member_expiries[v_i],
        membership_type = CASE WHEN v_i <= 3 THEN 'basic' ELSE 'premium' END,
        experience_level = (ARRAY['beginner','intermediate','advanced'])[1 + (v_i % 3)],
        goals = 'Build strength and improve conditioning',
        dob = (CURRENT_DATE - ((25 + v_i) * 365))
    WHERE user_id = v_member_ids[v_i];
  END LOOP;

  -- 5) Trainer assignments
  FOR v_i IN 1..8 LOOP
    v_trainer_id := v_trainer_ids[CASE WHEN v_i <= 4 THEN 1 ELSE 2 END];
    INSERT INTO public.trainer_assignments (trainer_id, member_id, gym_id, active)
    VALUES (v_trainer_id, v_member_ids[v_i], v_gym_id, true);
  END LOOP;

  -- 6) Fitness assessments — 3 per member, 4 weeks apart, improving
  FOR v_i IN 1..8 LOOP
    v_trainer_id := v_trainer_ids[CASE WHEN v_i <= 4 THEN 1 ELSE 2 END];
    FOR v_j IN 0..2 LOOP
      INSERT INTO public.fitness_assessments (
        member_id, trainer_id, gym_id, date,
        weight, height, bmi, body_fat_pct, muscle_mass,
        waist, chest, hips, arms, thighs,
        vo2_max, resting_hr, flexibility,
        bench_1rm, squat_1rm, deadlift_1rm, unit_system, notes
      ) VALUES (
        v_member_ids[v_i], v_trainer_id, v_gym_id,
        (CURRENT_DATE - ((2 - v_j) * 28)),
        (85 - v_j * 1.2 - v_i * 0.3),
        (175 + v_i),
        round(((85 - v_j*1.2 - v_i*0.3) / ((175 + v_i)/100.0)^2)::numeric, 1),
        (22 - v_j * 1.5),
        (38 + v_j * 0.8),
        (88 - v_j * 1.5),
        (102 + v_j * 0.5),
        (95 - v_j * 0.5),
        (34 + v_j * 0.5),
        (58 + v_j * 0.5),
        (40 + v_j * 2),
        (65 - v_j * 2),
        (25 + v_j * 2),
        (60 + v_j * 5 + v_i),
        (90 + v_j * 7 + v_i * 2),
        (110 + v_j * 8 + v_i * 2),
        'metric',
        'Progress check ' || (v_j+1)
      );
    END LOOP;
  END LOOP;

  -- 7) Workout plans — 2 per member (active + archived), 3 days each, 4-6 exercises
  FOR v_i IN 1..8 LOOP
    v_trainer_id := v_trainer_ids[CASE WHEN v_i <= 4 THEN 1 ELSE 2 END];
    FOR v_j IN 1..2 LOOP
      v_status := CASE WHEN v_j = 1 THEN 'active' ELSE 'archived' END;
      INSERT INTO public.workout_plans (member_id, trainer_id, gym_id, name, start_date, duration_weeks, status, notes)
      VALUES (v_member_ids[v_i], v_trainer_id, v_gym_id,
              CASE WHEN v_j=1 THEN 'Strength Block — Current' ELSE 'Foundations — Q1' END,
              CASE WHEN v_j=1 THEN CURRENT_DATE - 21 ELSE CURRENT_DATE - 120 END,
              8, v_status::plan_status,
              'Auto-generated demo plan')
      RETURNING id INTO v_plan_id;

      FOR v_day_idx IN 1..3 LOOP
        INSERT INTO public.workout_days (plan_id, day_label, "order")
        VALUES (v_plan_id,
                (ARRAY['Push Day','Pull Day','Leg Day'])[v_day_idx],
                v_day_idx)
        RETURNING id INTO v_day_id;

        FOR v_k IN 1..(4 + (v_day_idx % 3)) LOOP  -- 4,5,6
          INSERT INTO public.workout_exercises (day_id, exercise_id, sets, reps, rest_seconds, "order")
          VALUES (v_day_id,
                  v_ex_ids[1 + ((v_i + v_day_idx + v_k) % array_length(v_ex_ids,1))],
                  4, '6-10', 90, v_k);
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 8) 30 workout_logs per member over last 6 weeks with exercise_logs
  FOR v_i IN 1..8 LOOP
    -- pick this member's active plan + its first day
    SELECT wp.id, (SELECT wd.id FROM public.workout_days wd WHERE wd.plan_id = wp.id ORDER BY wd."order" LIMIT 1)
    INTO v_plan_id, v_day_id
    FROM public.workout_plans wp
    WHERE wp.member_id = v_member_ids[v_i] AND wp.status = 'active'
    LIMIT 1;

    FOR v_j IN 0..29 LOOP
      -- spread 30 sessions across ~42 days
      v_date := CURRENT_DATE - ((v_j * 42 / 30)::int);
      INSERT INTO public.workout_logs (member_id, plan_id, workout_day_id, gym_id, date, completed_at, effort_rating, notes)
      VALUES (v_member_ids[v_i], v_plan_id, v_day_id, v_gym_id, v_date,
              v_date + interval '18 hours',
              3 + ((v_i + v_j) % 3),  -- 3..5
              CASE WHEN v_j % 5 = 0 THEN 'Felt strong today' ELSE NULL END)
      RETURNING id INTO v_log_id;

      -- 3 exercise_logs per workout log
      FOR v_k IN 1..3 LOOP
        v_base_weight := 40 + v_i * 2 + v_k * 5 + (30 - v_j) * 0.3;
        INSERT INTO public.exercise_logs (log_id, exercise_id, set_number, weight, reps, completed)
        SELECT v_log_id,
               v_ex_ids[1 + ((v_i + v_j + v_k) % array_length(v_ex_ids,1))],
               s,
               v_base_weight + (s - 1) * 2.5,
               10 - s,
               true
        FROM generate_series(1,3) s;
      END LOOP;
    END LOOP;
  END LOOP;

  -- 9) 10 attendance_logs per member over last 30 days
  FOR v_i IN 1..8 LOOP
    FOR v_j IN 0..9 LOOP
      INSERT INTO public.attendance_logs (member_id, gym_id, check_in_at, check_out_at)
      VALUES (v_member_ids[v_i], v_gym_id,
              (CURRENT_DATE - (v_j * 3))::timestamp + interval '17 hours' + (v_i || ' minutes')::interval,
              (CURRENT_DATE - (v_j * 3))::timestamp + interval '18 hours 15 minutes');
    END LOOP;
  END LOOP;

  -- 10) 2 member_notes per member from assigned trainer
  FOR v_i IN 1..8 LOOP
    v_trainer_id := v_trainer_ids[CASE WHEN v_i <= 4 THEN 1 ELSE 2 END];
    INSERT INTO public.member_notes (gym_id, member_id, author_id, body) VALUES
      (v_gym_id, v_member_ids[v_i], v_trainer_id, 'Consistent attendance — ready to progress the squat.'),
      (v_gym_id, v_member_ids[v_i], v_trainer_id, 'Watch bench press bar path; slight drift left.');
  END LOOP;

  RAISE NOTICE 'Iron Works demo gym seeded successfully. Login: admin@ironworks.demo / demo1234';
END
$seed$;
