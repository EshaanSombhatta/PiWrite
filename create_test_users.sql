-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- Helper to insert a test user if they don't exist
do $$
declare
  new_user_id uuid := gen_random_uuid();
  test_email text := 'student3@test.com';
  test_password text := 'password123';
begin
  -- 1. Insert into auth.users
  -- We check if user exists first to avoid duplicates
  if not exists (select 1 from auth.users where email = test_email) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', -- Default instance_id
      new_user_id,
      'authenticated',
      'authenticated',
      test_email,
      crypt(test_password, gen_salt('bf')), -- Hash the password
      now(), -- Auto-confirm email
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- 2. Insert into public.profiles
    -- Note: Ensure your public.profiles table trigger doesn't conflict. 
    -- If you have a trigger that auto-creates profiles on auth.users insert, 
    -- you might need to update instead of insert, or disable the trigger.
    -- This assumes manual insertion is needed or safe.
    insert into public.profiles (id, email, full_name, age, grade_level, interests)
    values (
      new_user_id,
      test_email,
      'Timmy Tester',
      8,
      '3',
      ARRAY['Dinosaurs', 'Space']
    )
    on conflict (id) do nothing; -- Handle if profile already exists via trigger
    
  end if;


  -- Repeat for Student 5
  test_email := 'student5@test.com';
  new_user_id := gen_random_uuid();
  
  if not exists (select 1 from auth.users where email = test_email) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      test_email,
      crypt(test_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now()
    );

    insert into public.profiles (id, email, full_name, age, grade_level, interests)
    values (
      new_user_id,
      test_email,
      'Sarah Student',
      10,
      '5',
      ARRAY['Coding', 'Robots']
    )
    on conflict (id) do nothing;
  end if;

end $$;
