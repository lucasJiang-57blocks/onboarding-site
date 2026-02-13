import { Link } from "@/i18n/navigation";
import { Icon } from "@blueshift-gg/ui-components";
import { URLS } from "@/constants/urls";

export default function Footer() {
  const year = new Date().getFullYear();

  const twitterLink = URLS.BLUESHIFT_TWITTER;
  const githubLink = URLS.BLUESHIFT_GITHUB;
  const build =
    process.env.NEXT_PUBLIC_COMMIT_HASH?.substring(0, 7) ?? "DEVELOPMENT";

  return (
    <div className="border-t border-t-border bg-card-solid py-8">
      <div className="wrapper">
        <div className="flex flex-col sm:gap-y-0 gap-y-6 justify-center sm:flex-row items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="text-shade-tertiary/75 font-mono text-sm">
              57Blocks &copy; {year}
            </span>
            <span className="text-shade-tertiary/25 font-mono text-xs text-center sm:text-left mt-1">
              Commit: {build}
            </span>
          </div>
          <div className="flex items-center gap-x-8">
            <Link
              href={twitterLink}
              className="text-shade-tertiary hover:text-shade-primary transition"
            >
              <Icon name="X"></Icon>
            </Link>
            <Link
              href={githubLink}
              className="text-shade-tertiary hover:text-shade-primary transition"
            >
              <Icon name="Github"></Icon>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
