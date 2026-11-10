import { world, system } from "@minecraft/server";

const states = new Map();
const TICK_INTERVAL = 20;
const MAX_DREAD = 100;

function safeRun(operation) {
  try {
    operation();
  } catch (error) {
    console.warn(`[The Hollow] ${error}`);
  }
}

function playerState(player) {
  let state = states.get(player.id);
  if (!state) {
    state = { dread: 0, nextEvent: 15, lastPosition: undefined, stillTicks: 0 };
    states.set(player.id, state);
  }
  return state;
}

function tell(player, message) {
  player.sendMessage(`§8[§4THE HOLLOW§8] §7${message}`);
}

function startHunt(player) {
  const state = playerState(player);
  state.dread = Math.max(state.dread, 35);
  state.nextEvent = 3;
  tell(player, "You hear something breathing behind you.");
}

function resetFear(player) {
  states.delete(player.id);
  tell(player, "The silence returns. For now.");
}

function spawnStalker(player) {
  const dimension = player.dimension;
  const angle = Math.random() * Math.PI * 2;
  const distance = 12 + Math.random() * 8;
  const position = {
    x: player.location.x + Math.cos(angle) * distance,
    y: player.location.y,
    z: player.location.z + Math.sin(angle) * distance
  };
  const block = dimension.getBlock({ x: Math.floor(position.x), y: Math.floor(position.y), z: Math.floor(position.z) });
  if (!block || !block.isAir) return;
  const mob = dimension.spawnEntity("minecraft:enderman", position);
  mob.nameTag = "§4THE HOLLOW";
  mob.addEffect("slowness", 100, { amplifier: 1, showParticles: false });
}

function ambientEvent(player, state) {
  const roll = Math.random();
  if (roll < 0.24) {
    player.playSound("ambient.cave", { volume: 0.8, pitch: 0.55 + Math.random() * 0.25 });
    tell(player, "A whisper curls through the dark.");
  } else if (roll < 0.48) {
    player.playSound("mob.warden.nearby_close", { volume: 0.45, pitch: 0.7 });
    tell(player, "Something is close. Do not look back.");
  } else if (roll < 0.67) {
    player.addEffect("darkness", 80, { amplifier: 0, showParticles: false });
    player.playSound("ambient.cave", { volume: 1, pitch: 0.45 });
  } else if (roll < 0.83) {
    player.addEffect("slowness", 50, { amplifier: 0, showParticles: false });
    tell(player, "Your legs refuse to move.");
  } else {
    safeRun(() => spawnStalker(player));
  }
  state.dread = Math.min(MAX_DREAD, state.dread + 7);
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    safeRun(() => {
      const state = playerState(player);
      const location = player.location;
      if (state.lastPosition && location.x === state.lastPosition.x && location.y === state.lastPosition.y && location.z === state.lastPosition.z) {
        state.stillTicks++;
      } else {
        state.stillTicks = 0;
      }
      state.lastPosition = { x: location.x, y: location.y, z: location.z };

      const lightBlock = player.dimension.getBlock({ x: Math.floor(location.x), y: Math.floor(location.y + 1), z: Math.floor(location.z) });
      const isDark = lightBlock ? lightBlock.getLightLevel() < 7 : false;
      const underground = location.y < 45;
      if (underground || isDark) state.dread = Math.min(MAX_DREAD, state.dread + 0.12);
      else state.dread = Math.max(0, state.dread - 0.08);
      if (state.stillTicks > 180 && Math.random() < 0.08) state.dread = Math.min(MAX_DREAD, state.dread + 3);

      state.nextEvent -= 1;
      if (state.dread >= 20 && state.nextEvent <= 0) {
        ambientEvent(player, state);
        state.nextEvent = Math.max(12, 42 - Math.floor(state.dread / 4)) + Math.floor(Math.random() * 18);
      }
    });
  }
}, TICK_INTERVAL);

world.afterEvents.chatSend.subscribe((event) => {
  const message = event.message.trim().toLowerCase();
  if (message === "!hollow") startHunt(event.sender);
  if (message === "!hollow reset") resetFear(event.sender);
});

world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    event.player.sendMessage("§8The night is listening. Explore alone, underground, and in the dark. §7Type §c!hollow§7 to begin.");
  }
});
