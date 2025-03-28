import { watch } from "chokidar";
import { readFileSync } from "fs";
import { glob, readFile } from "fs/promises";
import path from "path";
import frontMatter from "front-matter";

if (!process.env.AI_HERO_TOKEN) {
  throw new Error("AI_HERO_TOKEN is required");
}

export const fetchFromAiHero = async (
  path: string,
  init?: Omit<RequestInit, "headers">,
) => {
  const result = await fetch(
    `https://www.aihero.dev/api${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.AI_HERO_TOKEN}`,
      },
    },
  );

  if (!result.ok) {
    console.error(result.status, result.statusText);
    console.dir(await result.json(), { depth: null });
    throw new Error(result.statusText);
  }

  return await result.json();
};

const filesLocation = path.join(
  process.cwd(),
  "examples",
  "**/*.md",
);

const files = await Array.fromAsync(
  await glob(filesLocation),
);

const watcher = watch(files, {
  ignoreInitial: true,
});

watcher.on("all", async (_eventName, filePath) => {
  const fileContents = await readFile(
    filePath,
    "utf-8",
  );

  const fm = (
    frontMatter as unknown as typeof frontMatter.default
  )(fileContents);

  const slug = (fm.attributes as { slug?: string })
    ?.slug;

  if (!slug) {
    return;
  }

  console.log(`📝 ${slug} changed`);

  try {
    const post: {
      id: string;
      fields: { title: string };
    } = await fetchFromAiHero(
      `/posts?slugOrId=${slug}`,
      {
        method: "GET",
      },
    );

    const id = post.id;

    await fetchFromAiHero(`/posts?id=${id}`, {
      method: "PUT",
      body: JSON.stringify({
        id,
        fields: {
          slug,
          title: post.fields.title,
          body: fm.body.trim(),
        },
      }),
    });

    console.log(
      `📝 ${slug} Updated: https://aihero.dev/${slug}`,
    );
  } catch (error) {
    console.error(error);
  }
});
