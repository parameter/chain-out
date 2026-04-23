const default_achievements = [
    {
        id: "default-0",
        "result": "ace",
        "zone": null,
        "condition": {
          "verifiedRound": "Yes"
        },
        "streak": {
          "minimum": 1,
          "scope": "same-round"
        },
        "title": "Ace Any hole",
        "description": "Make an Ace on Any hole.",
        "selectedHoles": [
          "any"
        ],
        "reward": "800",
        "difficulty": "Hard",
        "verifiedOnly": false
    },
    {
        id: "default-1",
        "result": "-1",
        "zone": null,
        "condition": {
          "verifiedRound": "Yes"
        },
        "streak": {
          "minimum": 5,
          "scope": "in-a-row-same-round"
        },
        "title": "Birdie 5 holes in a row",
        "description": "Score 5 birdies in a row during the same round.",
        "selectedHoles": [
          "any"
        ],
        "reward": "500",
        "difficulty": "hard",
        "verifiedOnly": false
    },
    {
        id: "default-2",
        "zone": null,
        "condition": {
          "scramble": "Yes",
          "verifiedRound": "Yes"
        },
        "streak": {
          "minimum": 3,
          "scope": "in-a-row-same-round"
        },
        "title": "Scramble 3 times",
        "description": "Scramble 3 times during the same round.",
        "selectedHoles": [
          "any"
        ],
        "reward": "500",
        "difficulty": "Cosmic",
        "verifiedOnly": false
    },
    {
        id: "default-3",
        "result": "-2",
        "zone": null,
        "condition": {
          "verifiedRound": "Yes"
        },
        "streak": {
          "minimum": 1,
          "scope": "same-round"
        },
        "title": "Eagle Any par 4",
        "description": "Score a eagle on Any par 4.",
        "selectedHoles": [],
        "reward": "800",
        "difficulty": "Medium",
        "verifiedOnly": false
    },
    {
        id: "default-4",
        "zone": "Bullseye",
        "condition": {
          "verifiedRound": "Yes"
        },
        "streak": {
          "minimum": 3,
          "scope": "same-round"
        },
        "title": "Eagle Any hole",
        "description": "Hit 3 bullseyes in a row during the same round.",
        "selectedHoles": [
          "any"
        ],
        "reward": "1200",
        "difficulty": "Medium",
        "verifiedOnly": false
    }
      
]

export default default_achievements;