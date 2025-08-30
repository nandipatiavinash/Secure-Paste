CREATE TABLE "access_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paste_id" varchar NOT NULL,
	"viewer_ip" text NOT NULL,
	"user_agent" text,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pastes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"title" text,
	"language" text DEFAULT 'plaintext',
	"owner_id" varchar,
	"expires_at" timestamp,
	"self_destruct" boolean DEFAULT false,
	"encrypted" boolean DEFAULT false,
	"password" text,
	"view_count" integer DEFAULT 0,
	"max_views" integer,
	"scan_status" text DEFAULT 'pending',
	"scan_results" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shareable_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paste_id" varchar NOT NULL,
	"token" text NOT NULL,
	"created_by" varchar,
	"expires_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"max_usage" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shareable_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"virustotal_api_key" text,
	"google_safe_browsing_api_key" text,
	"email_notifications" boolean DEFAULT true,
	"default_expiry" text DEFAULT '1day',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "access_logs" ADD CONSTRAINT "access_logs_paste_id_pastes_id_fk" FOREIGN KEY ("paste_id") REFERENCES "public"."pastes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pastes" ADD CONSTRAINT "pastes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shareable_links" ADD CONSTRAINT "shareable_links_paste_id_pastes_id_fk" FOREIGN KEY ("paste_id") REFERENCES "public"."pastes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shareable_links" ADD CONSTRAINT "shareable_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;