# BotW Cooking Planner

A cooking planner for *Zelda: Breath of the Wild*, made for the iPad and styled like the
in-game menu.

Tap in the ingredients you have, pick the effect you want to cook for (hearts, stamina,
cold resistance, …), and it shows the best dishes you can make from your inventory.
When you cook one, tap "Cooked" and the ingredients are taken off your list.

## Artwork

The icons and the background image are © Nintendo, taken from
[Zelda Wiki](https://zeldawiki.wiki). This is a non-commercial fan project, not affiliated
with or endorsed by Nintendo.

## Deploying

The `Dockerfile` builds the static PWA and serves it with nginx on port 80. No environment
variables are needed. Serve it over HTTPS, since the PWA can only be installed over HTTPS.

To try the production image locally: `docker compose up --build` → http://localhost:8000
