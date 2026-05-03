const default_achievements = [
    {
        id: "default-0",
        "result": "ace",
        "zone": null,
        "condition": {},
        "streak": {
          "minimum": 1,
          "scope": "same-round"
        },
        "title": "Ace Any Hole",
        "description": "Make an ace on any hole.",
        "selectedHoles": [
          "any"
        ],
        "reward": "800",
        "difficulty": "extreme",
        "verifiedOnly": false
    },
    {
        id: "default-1",
        "result": "-1",
        "zone": null,
        "condition": {},
        "streak": {
          "minimum": 5,
          "scope": "in-a-row-same-round"
        },
        "title": "Yatzy!",
        "description": "Score 5 birdies in a row during a round.",
        "selectedHoles": [
          "any"
        ],
        "reward": "500",
        "difficulty": "medium",
        "verifiedOnly": false
    },
    {
        id: "default-2",
        "zone": null,
        "condition": {
          "scramble": "Yes"
        },
        "streak": {
          "minimum": 3,
          "scope": "same-round"
        },
        "title": "Scramble 3 Times",
        "description": "Scramble 3 times during the same round.",
        "selectedHoles": [
          "any"
        ],
        "reward": "500",
        "difficulty": "medium",
        "verifiedOnly": false
    },
    {
        id: "default-3",
        "result": "-2",
        "zone": null,
        "condition": {
          "mustBePar": [4, 5]
        },
        "streak": {
          "minimum": 1,
          "scope": "same-round"
        },
        "title": "Eagle Any Par 4/5",
        "description": "Score an eagle on any par 4 or 5.",
        "selectedHoles": [],
        "reward": "800",
        "difficulty": "hard",
        "verifiedOnly": false
    },
    {
        id: "default-4",
        "zone": "Bullseye",
        "condition": {},
        "streak": {
          "minimum": 5,
          "scope": "same-round"
        },
        "title": "Hit 5 Bullseyes",
        "description": "Hit 5 bullseyes in one round",
        "selectedHoles": [
          "any"
        ],
        "reward": "1200",
        "difficulty": "hard",
        "verifiedOnly": false
    }
      
]

module.exports = default_achievements;