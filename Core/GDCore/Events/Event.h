/** \file
 *  Game Develop
 *  2008-2012 Florian Rival (Florian.Rival@gmail.com)
 */
#ifndef GDCORE_EVENT_H
#define GDCORE_EVENT_H

#include <iostream>
#include <vector>
#include <string>
#include <vector>
#include <boost/shared_ptr.hpp>
#include <boost/weak_ptr.hpp>
#include "GDCore/Events/Instruction.h"
class Game;
namespace gd { class MainFrameWrapper; }
class wxWindow;
class EventsEditorItemsAreas;
class EventsEditorSelection;
class Scene;
namespace gd { class Instruction; }
class TiXmlElement;
class Game;
class EventsCodeGenerator;
class EventsCodeGenerationContext;
class wxDC;

namespace gd
{

class BaseEvent;
typedef boost::shared_ptr<BaseEvent> BaseEventSPtr;

/**
 * \brief Base class defining an event.
 *
 * Events are usually not instance of Base Event, but instance of a derived class.
 *
 * \ingroup Events
 */
class GD_CORE_API BaseEvent
{
public:
    BaseEvent();
    virtual ~BaseEvent();

    /**
     * Must return a pointer to a copy of the event.
     * A such method is needed as the IDE may want to store copies of some events and so need a way to do polymorphic copies.
     *
     * Typical implementation example:
     * \code
     * return boost::shared_ptr<gd::BaseEvent>(new MyEventClass(*this));
     * \endcode
     */
    virtual gd::BaseEventSPtr Clone() const { return boost::shared_ptr<gd::BaseEvent>(new BaseEvent(*this));}

    /** \name Event properties
     * Members functions to be overridden by derived classes to expose the event properties
     */
    ///@{

    /**
     * Derived class have to redefine this function, so as to return true, if they are executable.
     */
    virtual bool IsExecutable() const {return false;};

    /**
     * Derived class have to redefine this function, so as to return true, if they have sub events.
     */
    virtual bool CanHaveSubEvents() const {return false;}

    /**
     * Return the sub events, if applicable.
     */
    virtual const std::vector < gd::BaseEventSPtr > & GetSubEvents() const {return badSubEvents;};

    /**
     * Return the sub events, if applicable.
     */
    virtual std::vector < gd::BaseEventSPtr > & GetSubEvents() {return badSubEvents;};

    /**
     * Event must be able to return all conditions std::vector they have.
     * Used to preprocess the conditions.
     */
    virtual std::vector < std::vector<Instruction>* > GetAllConditionsVectors() { std::vector < std::vector<Instruction>* > noConditions; return noConditions; };

    /**
     * Event must be able to return all actions std::vector they have.
     * Used to preprocess the actions.
     */
    virtual std::vector < std::vector<Instruction>* > GetAllActionsVectors() { std::vector < std::vector<Instruction>* > noActions; return noActions; };

    /**
     * Event must be able to return all expressions they have.
     * Used to preprocess the expressions.
     */
    virtual std::vector < gd::Expression* > GetAllExpressions() { std::vector < gd::Expression* > noExpr; return noExpr;};

    ///@}

    /** \name Code generation
     * Members functions used to generate code from the event
     *
     * \todo For now, these methods are specially designed to work with Game Develop C++ Platform code generation
     */
    ///@{

    /**
     * Generate event's code.
     * Implementation example :
     * \code
        std::string outputCode;

        outputCode += codeGenerator.GenerateConditionsListCode(game, scene, conditions, context);

        std::string ifPredicat;
        for (unsigned int i = 0;i<conditions.size();++i)
        {
            if (i!=0) ifPredicat += " && ";
            ifPredicat += "condition"+ToString(i)+"IsTrue";
        }

        if ( !ifPredicat.empty() ) outputCode += "if (" +ifPredicat+ ")\n";
        outputCode += "{\n";
        outputCode += codeGenerator.GenerateActionsListCode(game, scene, actions, context);
        if ( !events.empty() ) //Sub events
        {
            outputCode += "\n{\n";
            outputCode += codeGenerator.GenerateEventsListCode(game, scene, events, context);
            outputCode += "}\n";
        }

        outputCode += "}\n";

        return outputCode;
     * \endcode
     */
    virtual std::string GenerateEventCode(Game & game, Scene & scene, EventsCodeGenerator & codeGenerator, EventsCodeGenerationContext & context) {return "";};

    /**
     * Called before events are compiled
     */
    virtual void Preprocess(const Game & game, const Scene & scene, std::vector < gd::BaseEventSPtr > & eventList, unsigned int indexOfTheEventInThisList) {};

    ///@}

    /** \name Serialization
     */
    ///@{

    /**
     * Save event to XML
     */
    virtual void SaveToXml(TiXmlElement * eventElem) const {}

    /**
     * Load event from XML
     */
    virtual void LoadFromXml(const TiXmlElement * eventElem) {}

    ///@}

    /** \name Common properties
     * Common method shared by all events. ( No need for them to be overridden by derived classes ).
     */
    ///@{

    /**
     * Return the event type
     */
    std::string GetType() const { return type; };

    /**
     * Change the event type
     */
    void SetType(std::string type_) { type = type_; };

    /**
     * Set if the event if disabled or not
     */
    void SetDisabled(bool disable = true) { disabled = disable; }

    /**
     * True if event is disabled
     */
    bool IsDisabled() const { return disabled; }

    ///@}

    /** \name Event rendering
     * Method and members used to render the event
     */
    ///@{

    /**
     * Redefine this method to draw the event.
     *
     * \param dc The wxWidgets drawing context to be used.
     * \param x The x position where the events must be drawn.
     * \param y The y position where the events must be drawn.
     * \param width The width available for drawing.
     * \param areas Use this object to indicate the areas where items have been drawn
     * \param selection Give access to the current selection(s), to draw for example hovering or selecting effects.
     *
     * \note The height of the drawing must be the same as the height returned by BaseEvent::GetRenderedHeight
     *
     * \see gd::EventsRenderingHelper
     * \see EventsEditorSelection
     * \see EventsEditorItemsAreas
     */
    virtual void Render(wxDC & dc, int x, int y, unsigned int width, EventsEditorItemsAreas & areas, EventsEditorSelection & selection) {return;}

    /**
     * Must return the height of the event when rendered.
     *
     * \note The height of the drawing must be the same as the height of the drawing made by BaseEvent::Render
     */
    virtual unsigned int GetRenderedHeight(unsigned int width) const {return 0;};

    /**
     * Used by EditEvent to describe what sort of changes have been made to the event.
     * \see BaseEvent::EditEvent
     */
    enum EditEventReturnType
    {
        ChangesMade,
        Cancelled,
        ChangesMadeButNoNeedForEventsRecompilation
    };

    /**
     * Called when the user want to edit the event.
     */
    virtual EditEventReturnType EditEvent(wxWindow* parent_, Game & game_, Scene & scene_, gd::MainFrameWrapper & mainFrameWrapper_) { return ChangesMade; };

    ///@}

    bool            folded; ///< Here as it must be saved. Used by events editor
    mutable bool    eventHeightNeedUpdate; ///<Automatically set to true/false by the events editor

    boost::weak_ptr<gd::BaseEvent> originalEvent; ///< Pointer only used for profiling events, so as to remember the original event from which it has been copied.
    unsigned long int totalTimeDuringLastSession; ///< Total time used by the event during the last run. Used for profiling.
    float percentDuringLastSession; ///< Total time used by the event during the last run. Used for profiling.

protected:
    mutable unsigned int    renderedHeight;

private:
    bool                    disabled; ///<True if the event is disabled and must not be executed
    std::string             type; ///<Type of the event. Must be assigned at the creation. Used for saving the event for instance.

    static std::vector <BaseEventSPtr> badSubEvents;
};

/**
 * Clone an event and insert a reference to the original event into the newly created event.
 * Used for profiling events for example.
 *
 * \see BaseEvent
 * \ingroup Events
 */
BaseEventSPtr GD_CORE_API CloneRememberingOriginalEvent(gd::BaseEventSPtr event);

/**
 * Helper function for copying std::vector of shared_ptr of events
 *
 * \see BaseEvent
 * \ingroup Events
 */
std::vector < gd::BaseEventSPtr > GD_CORE_API CloneVectorOfEvents(const std::vector < gd::BaseEventSPtr > & events);

}

#endif // GDCORE_EVENT_H
